import { requireLogin } from "../../../core/auth";
import { getSession, saveSession, clearSession } from "../../../core/session";
import { back, go } from "../../../core/routes";
import { errorMessage } from "../../../core/request";
import { uploadImage } from "../../../core/upload";
import { env } from "../../../core/env";
import { accountApi } from "../api";
Page({
  data: {
    nickname: "",
    avatarRef: null as string | null,
    avatarPath: "",
    newAvatar: false,
    busy: false,
    ready: false,
    message: "",
  },
  async onLoad() {
    if (!requireLogin("settings")) return;
    try {
      const user = await accountApi.me();
      this.setData({
        nickname: user.nickname || "",
        avatarRef: user.avatarRef,
        avatarPath: user.avatarRef
          ? env.apiBase + "/api/v1/media/" + encodeURIComponent(user.avatarRef)
          : "",
        ready: true,
      });
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    }
  },
  retry() {
    void this.onLoad();
  },
  setNick(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value });
  },
  chooseAvatar() {
    if (this.data.busy) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      success: (r) =>
        this.setData({
          avatarPath: r.tempFiles[0].tempFilePath,
          newAvatar: true,
        }),
    });
  },
  async save() {
    if (this.data.busy || !requireLogin("settings")) return;
    const s = getSession()!;
    this.setData({ busy: true, message: "" });
    try {
      let avatarRef = this.data.avatarRef;
      if (this.data.newAvatar) {
        const up = await uploadImage(this.data.avatarPath, "avatar");
        avatarRef = up.imageRef;
        this.setData({ avatarRef, newAvatar: false });
      }
      const user = await accountApi.save(this.data.nickname.trim(), avatarRef);
      if (getSession()?.token === s.token) saveSession({ ...s, user });
      this.setData({ message: "资料已保存" });
    } catch (e) {
      this.setData({ message: errorMessage(e) });
    } finally {
      this.setData({ busy: false });
    }
  },
  async logout() {
    if (this.data.busy) return;
    const yes = await new Promise<boolean>((resolve) =>
      wx.showModal({
        title: "退出登录",
        content: "确定退出当前账号？",
        success: (r) => resolve(r.confirm),
        fail: () => resolve(false),
      }),
    );
    if (!yes) return;
    this.setData({ busy: true });
    try {
      await accountApi.logout();
      clearSession();
      go("account");
    } catch (e) {
      if (!getSession()) go("account");
      else this.setData({ message: errorMessage(e) });
    } finally {
      this.setData({ busy: false });
    }
  },
  back() {
    back("account");
  },
});
