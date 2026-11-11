import type { Post } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage } from "../../../core/request";
import { back, go } from "../../../core/routes";
Page({
  data: { posts: [] as Post[], state: "loading", message: "", asOf: "" },
  onShow() {
    void this.load();
  },
  async load() {
    this.setData({ state: "loading", posts: [], message: "" });
    try {
      const result = await api.hot();
      this.setData({
        posts: result.items,
        state: result.items.length ? "ready" : "empty",
        asOf: result.asOf,
      });
    } catch (e) {
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
