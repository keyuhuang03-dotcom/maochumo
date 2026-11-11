import { env } from "../../../core/env";
import { developmentLogin, wechatLogin } from "../../../core/auth";
import { errorMessage } from "../../../core/request";
import { resume, back } from "../../../core/routes";
Page({
  data: {
    development: env.development,
    key: "",
    message: "",
    busy: false,
    returnTo: "account",
  },
  onLoad(o) {
    this.setData({ returnTo: o.returnTo || "account" });
  },
  keyInput(e: WechatMiniprogram.Input) {
    this.setData({ key: e.detail.value });
  },
  async login(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy) return;
    this.setData({ busy: true, message: "" });
    try {
      if (e.currentTarget.dataset.mode === "dev")
        await developmentLogin(this.data.key.trim());
      else await wechatLogin();
      this.setData({ key: "" });
      resume(this.data.returnTo);
    } catch (err) {
      this.setData({ message: errorMessage(err) });
    } finally {
      this.setData({ busy: false });
    }
  },
  back() {
    back("account");
  },
});
