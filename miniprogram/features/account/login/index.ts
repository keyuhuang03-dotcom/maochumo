import { request } from "../../../core/request";
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
    checking: true,
    wechatAvailable: false,
    devAvailable: false,
  },
  onLoad(o) {
    this.setData({ returnTo: o.returnTo || "account" });
    void this.checkCapabilities();
  },
  async checkCapabilities() {
    this.setData({ checking: true, message: "" });
    try {
      const status = await request<{
        wechatLogin: boolean;
        developmentLogin: boolean;
      }>("/api/v1/capabilities");
      this.setData({
        wechatAvailable: status.wechatLogin,
        devAvailable: env.development && status.developmentLogin,
      });
    } catch (error) {
      this.setData({ message: errorMessage(error) });
    } finally {
      this.setData({ checking: false });
    }
  },
  keyInput(e: WechatMiniprogram.Input) {
    this.setData({ key: e.detail.value });
  },
  async login(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.checking) return;
    const dev = e.currentTarget.dataset.mode === "dev";
    if (dev && !this.data.key.trim()) {
      this.setData({
        message: "请先填写本机.env中DEV_LOGIN_KEY等号后面的完整口令",
      });
      return;
    }
    if (
      (dev && !this.data.devAvailable) ||
      (!dev && !this.data.wechatAvailable)
    )
      return;
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
