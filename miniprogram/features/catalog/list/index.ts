import { back, go } from "../../../core/routes";
Page({
  data: {
    title: "猫咪图鉴",
    owner: "成员 A",
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
    back("catalog");
  },
  open(e: WechatMiniprogram.TouchEvent) {
    go(e.currentTarget.dataset.route);
  },
});
