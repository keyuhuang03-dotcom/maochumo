import { back, go } from "../../../core/routes";
Page({
  data: {
    title: "十大热帖",
    owner: "项目负责人",
    catId: "",
    postId: "",
    areaId: "",
    commentId: "",
  },
  onLoad(options) {
    this.setData({
      catId: options.catId || "",
      postId: options.postId || "",
      areaId: options.areaId || "",
      commentId: options.commentId || "",
    });
  },
  back() {
    back("home");
  },
  open(e: WechatMiniprogram.TouchEvent) {
    go(e.currentTarget.dataset.route);
  },
});
