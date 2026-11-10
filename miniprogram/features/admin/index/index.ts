import { back, go } from "../../../core/routes";
Page({
  data: {
    title: "管理员工作台",
    owner: "成员 C",
    id: "",
    catId: "",
    postId: "",
    areaId: "",
    commentId: "",
  },
  onLoad(options) {
    this.setData({
      id: options.id || "",
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
