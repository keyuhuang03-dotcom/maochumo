import type { Post } from "../../../../contracts/index";
import { api } from "../../../core/api";
import { errorMessage } from "../../../core/request";
import { back, go } from "../../../core/routes";
Page({
  data: {
    post: null as Post | null,
    state: "loading",
    message: "",
    postId: "",
    commentId: "",
  },
  onLoad(options) {
    this.setData({
      postId: options.postId || "",
      commentId: options.commentId || "",
    });
  },
  onShow() {
    void this.load();
  },
  async load() {
    this.setData({ state: "loading", post: null, message: "" });
    try {
      this.setData({ post: await api.post(this.data.postId), state: "ready" });
    } catch (e) {
      this.setData({ state: "error", message: errorMessage(e) });
    }
  },
  back() {
    back();
  },
  cat(e: WechatMiniprogram.TouchEvent) {
    go("cat", { catId: e.currentTarget.dataset.id });
  },
});
