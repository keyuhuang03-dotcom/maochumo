import { back, go } from "../../../core/routes";
Page({
  data: {
    title: "我的点赞",
    owner: "成员 B",
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
    back("account");
  },
  open(e: WechatMiniprogram.TouchEvent) {
    go(e.currentTarget.dataset.route);
  },
});
