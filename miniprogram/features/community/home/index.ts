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
  },
  sequence: 0,
  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
  },
  onReachBottom() {
    void this.more();
  },
  onShow() {
    void this.load();
  },
  async load() {
    const sequence = ++this.sequence;
    this.setData({ state: "loading", message: "", posts: [] });
    try {
      const result = await api.posts();
      if (sequence !== this.sequence) return;
      this.setData({
        posts: result.items,
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
