import { back, go } from "../../../core/routes";
import { isAdmin, isLoggedIn } from "../access";
Page({
  data: {
    title: "管理员工作台",
    loggedIn: false,
    admin: false,
    ready: false,
  },
  onShow() {
    this.setData({
      loggedIn: isLoggedIn(),
      admin: isAdmin(),
      ready: true,
    });
  },
  login() {
    go("login");
  },
  open(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.admin) return;
    go(e.currentTarget.dataset.route);
  },
  back() {
    back("account");
  },
});
