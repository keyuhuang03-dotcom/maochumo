import { getSession } from "../../../core/session";
import { go } from "../../../core/routes";
Page({
  data: { loggedIn: false, admin: false, nickname: "" },
  onShow() {
    const s = getSession();
    this.setData({
      loggedIn: !!s,
      admin: s?.user.role === "admin",
      nickname: s?.user.nickname || "游客",
    });
  },
  open(e: WechatMiniprogram.TouchEvent) {
    go(e.currentTarget.dataset.route);
  },
});
