import type { Post } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage } from "../../../core/request";
import { go } from "../../../core/routes";
Page({
  data: {
    posts: [] as Post[],
    state: "loading",
    message: "",
    page: 1,
    hasMore: false,
    hotPost: null as Post | null,
    toolbarTop: 64,
  },
  sequence: 0,
  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
  },
  onReachBottom() {
    void this.more();
  },
  onLoad() {
    const info = wx.getWindowInfo();
    const capsule = wx.getMenuButtonBoundingClientRect();
    this.setData({
      toolbarTop:
        info.statusBarHeight +
        Math.max(44, (capsule.top - info.statusBarHeight) * 2 + capsule.height),
    });
  },
  onShow() {
    void this.load();
  },
  async load() {
    const sequence = ++this.sequence;
    this.setData({ state: "loading", message: "", posts: [] });
    try {
      const [result, hot] = await Promise.all([
        api.posts(),
        api.hot().catch(() => ({ items: [] as Post[], asOf: "" })),
      ]);
      if (sequence !== this.sequence) return;
      this.setData({
        posts: result.items,
        hotPost: hot.items[0] || null,
        state: result.items.length ? "ready" : "empty",
        page: 1,
        hasMore: result.hasMore,
      });
    } catch (e) {
      if (sequence === this.sequence)
        this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  async more() {
    if (!this.data.hasMore || this.data.state === "loading") return;
    const sequence = this.sequence;
    this.setData({ state: "loading" });
    try {
      const result = await api.posts(this.data.page + 1);
      if (sequence !== this.sequence) return;
      this.setData({
        posts: this.data.posts.concat(result.items),
        page: result.page,
        hasMore: result.hasMore,
        state: "ready",
      });
    } catch (e) {
      if (sequence === this.sequence)
        this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  openPost(e: WechatMiniprogram.CustomEvent<{ postId: string }>) {
    go("post", { postId: e.detail.postId });
  },
  search() {
    go("search");
  },
  hot() {
    go("hot");
  },
});
