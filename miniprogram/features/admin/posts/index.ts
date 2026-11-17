import { getSession } from "../../../core/session";
import { pendingAdmin, submitAdmin, pendingMessage } from "../submission";
import type { HidePost, Post } from "../../../../contracts/index";
import { errorMessage } from "../../../core/request";
import { requestKey } from "../../../core/submission";
import { back } from "../../../core/routes";
import { isAdmin } from "../access";
import { adminApi } from "../api";

Page({
  data: {
    title: "隐藏帖子",
    admin: false,
    ready: false,
    keyword: "",
    posts: [] as Post[],
    page: 1,
    hasMore: false,
    busy: false,
    pending: false,
    message: "",
    selectedId: "",
    reason: "",
  },
  requestKeyValue: "",
  initialized: false,
  actorId: "",
  loadGeneration: 0,
  loadingList: false,
  onShow() {
    const actorId = getSession()?.user.id || "";
    if (actorId !== this.actorId) {
      this.actorId = actorId;
      this.initialized = false;
      this.setData({ busy: false, pending: false });
    }
    if (!isAdmin()) {
      this.setData({ admin: false, ready: true });
      return;
    }
    this.setData({ admin: true });
    const pending = pendingAdmin<HidePost>("posts");
    this.setData({ pending: !!pending });
    if (pending) {
      this.requestKeyValue = pending.input.requestKey;
      this.setData({
        selectedId: pending.id,
        reason: pending.input.reason || "",
        message: pendingMessage,
      });
    }
    if (!this.initialized) {
      this.initialized = true;
      if (!pending) {
        this.requestKeyValue = requestKey();
        this.setData({ selectedId: "", reason: "", message: "" });
      }
    }
    void this.load();
  },
  onUnload() {
    this.loadGeneration++;
    this.initialized = false;
  },
  async load(append = false) {
    if (append && this.loadingList) return;
    const generation = ++this.loadGeneration;
    this.loadingList = true;
    try {
      const result = await adminApi.posts(
        append ? this.data.page + 1 : 1,
        this.data.keyword,
      );
      if (generation !== this.loadGeneration) return;
      this.setData({
        ready: true,
        posts: append ? [...this.data.posts, ...result.items] : result.items,
        page: result.page,
        hasMore: result.hasMore,
      });
    } catch (e) {
      if (generation === this.loadGeneration)
        this.setData({ ready: true, message: errorMessage(e) });
    } finally {
      if (generation === this.loadGeneration) this.loadingList = false;
    }
  },
  more() {
    if (!this.data.busy && this.data.hasMore) void this.load(true);
  },
  searchInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value });
  },
  search() {
    if (this.data.busy || this.data.pending) return;
    this.setData({ busy: true, message: "", selectedId: "" });
    void this.load().then(() => this.setData({ busy: false }));
  },
  select(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.pending) return;
    this.requestKeyValue = requestKey();
    this.setData({
      selectedId: e.currentTarget.dataset.id,
      reason: "",
      message: "",
    });
  },
  cancel() {
    if (this.data.busy || this.data.pending) return;
    this.setData({ selectedId: "", reason: "", message: "" });
  },
  reasonInput(e: WechatMiniprogram.Input) {
    if (this.data.busy || this.data.pending) return;
    this.setData({ reason: e.detail.value });
  },
  async confirm() {
    if (this.data.busy || !this.data.selectedId) return;
    const reason = this.data.reason.trim();
    const postId = this.data.selectedId;
    const confirmed = await new Promise<boolean>((resolve) =>
      wx.showModal({
        title: "确认隐藏",
        content:
          "隐藏后首页、搜索、热榜、详情和档案关联均不可见，且没有恢复接口。",
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false),
      }),
    );
    if (!confirmed) return;
    if (!this.requestKeyValue) this.requestKeyValue = requestKey();
    const input: HidePost = {
      reason,
      requestKey: this.requestKeyValue,
    };
    this.setData({ busy: true, message: "" });
    try {
      await submitAdmin("posts", postId, input, (id, payload) =>
        adminApi.hidePost(id, payload),
      );
      this.requestKeyValue = requestKey();
      this.setData({
        busy: false,
        pending: false,
        selectedId: "",
        reason: "",
        message: "已隐藏帖子 " + postId,
      });
      await this.load();
    } catch (e) {
      const pending = !!pendingAdmin("posts");
      if (!pending) this.requestKeyValue = requestKey();
      this.setData({
        busy: false,
        pending,
        message: pending ? pendingMessage : errorMessage(e),
      });
    }
  },
  back() {
    back("admin");
  },
});
