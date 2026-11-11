import type { Post } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage } from "../../../core/request";
import { go, back } from "../../../core/routes";
Page({
  data: {
    posts: [] as Post[],
    q: "",
    topicId: "",
    state: "idle",
    message: "",
    page: 0,
    hasMore: false,
  },
  sequence: 0,
  onLoad(o) {
    this.setData({ q: o.q || "", topicId: o.topicId || "" });
    void this.search();
  },
  input(e: WechatMiniprogram.Input) {
    this.setData({ q: e.detail.value });
  },
  async search() {
    const sequence = ++this.sequence;
    this.setData({ posts: [], state: "loading", message: "", page: 0 });
    try {
      const result = await api.posts(1, this.data.q.trim(), this.data.topicId);
      if (sequence !== this.sequence) return;
      this.setData({
        posts: result.items,
        page: 1,
        hasMore: result.hasMore,
        state: result.items.length ? "ready" : "empty",
      });
    } catch (e) {
      if (sequence === this.sequence)
        this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  clear() {
    this.setData({ q: "", topicId: "" });
    void this.search();
  },
  async more() {
    if (!this.data.hasMore || this.data.state === "loading") return;
    const sequence = this.sequence;
    this.setData({ state: "loading" });
    try {
      const result = await api.posts(
        this.data.page + 1,
        this.data.q.trim(),
        this.data.topicId,
      );
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
  back() {
    back();
  },
});
