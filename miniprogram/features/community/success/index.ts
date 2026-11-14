import { go } from "../../../core/routes";
Page({
  data: { postId: "" },
  onLoad(o) {
    this.setData({ postId: o.postId || "" });
  },
  viewPost() {
    if (this.data.postId) go("post", { postId: this.data.postId });
  },
  home() {
    go("home");
  },
  again() {
    go("publish");
  },
});
