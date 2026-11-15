import type { Notification } from "../../../../contracts/index";
import { requireLogin } from "../../../core/auth";
import { back, go } from "../../../core/routes";
import { errorMessage } from "../../../core/request";
import { accountApi } from "../api";
Page({
  data: {
    list: [] as Notification[],
    loading: false,
    busy: false,
    state: "loading",
    message: "",
    page: 0,
    hasMore: false,
    unreadCount: 0,
  },
  generation: 0,
  onShow() {
    if (requireLogin("messages")) void this.fetchList(true);
  },
  onHide() {
    this.generation++;
  },
  async fetchList(reset = false) {
    if (!reset && this.data.loading) return;
    const g = reset ? ++this.generation : this.generation;
    this.setData({
      loading: true,
      message: "",
      ...(reset ? { state: "loading", list: [] } : {}),
    });
    try {
      const [r, count] = await Promise.all([
        accountApi.messages(reset ? 1 : this.data.page + 1),
        accountApi.unread(),
      ]);
      if (g !== this.generation) return;
      const list = reset ? r.items : [...this.data.list, ...r.items];
      this.setData({
        list,
        page: r.page,
        hasMore: r.hasMore,
        unreadCount: count.count,
        state: list.length ? "ready" : "empty",
      });
    } catch (e) {
      if (g === this.generation)
        this.setData({ state: "error", message: errorMessage(e) });
    } finally {
      if (g === this.generation) this.setData({ loading: false });
    }
  },
  onReachBottom() {
    if (this.data.hasMore) void this.fetchList();
  },
  more() {
    void this.fetchList();
  },
  retry() {
    void this.fetchList(true);
  },
  async markRead(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await accountApi.read(e.currentTarget.dataset.id);
      await this.fetchList(true);
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    } finally {
      this.setData({ busy: false });
    }
  },
  async markAllRead() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await accountApi.readAll();
      await this.fetchList(true);
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    } finally {
      this.setData({ busy: false });
    }
  },
  async openPost(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy) return;
    const n = this.data.list.find((x) => x.id === e.currentTarget.dataset.id);
    if (!n) return;
    this.setData({ busy: true, message: "" });
    try {
      await accountApi.read(n.id);
      await this.fetchList(true);
      if (!n.targetAvailable) {
        wx.showToast({ title: "内容已隐藏或删除", icon: "none" });
        return;
      }
      go("post", { postId: n.postId, commentId: n.commentId });
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    } finally {
      this.setData({ busy: false });
    }
  },
  back() {
    back("account");
  },
});
