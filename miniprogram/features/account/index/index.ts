import type { User } from "../../../../contracts/index";
import { getSession, saveSession } from "../../../core/session";
import { go } from "../../../core/routes";
import { errorMessage } from "../../../core/request";
import { env } from "../../../core/env";
import { accountApi } from "../api";
Page({
  data: {
    user: null as User | null,
    loggedIn: false,
    admin: false,
    unreadCount: 0,
    message: "",
    avatarUrl: "",
  },
  generation: 0,
  async onShow() {
    const g = ++this.generation;
    const s = getSession();
    this.setData({
      user: s?.user || null,
      loggedIn: !!s,
      admin: s?.user.role === "admin",
      unreadCount: 0,
      message: "",
      avatarUrl: "",
    });
    if (!s) return;
    try {
      const [user, count] = await Promise.all([
        accountApi.me(),
        accountApi.unread(),
      ]);
      if (g !== this.generation || getSession()?.token !== s.token) return;
      saveSession({ ...s, user });
      this.setData({
        user,
        admin: user.role === "admin",
        unreadCount: count.count,
        avatarUrl: user.avatarRef
          ? env.apiBase + "/api/v1/media/" + encodeURIComponent(user.avatarRef)
          : "",
      });
    } catch (e) {
      if (g === this.generation)
        this.setData({ message: errorMessage(e), loggedIn: !!getSession() });
    }
  },
  onHide() {
    this.generation++;
  },
  open(e: WechatMiniprogram.TouchEvent) {
    go(e.currentTarget.dataset.route);
  },
  gotoMessages() {
    go("messages");
  },
  gotoSettings() {
    go("settings");
  },
  gotoPosts() {
    go("posts");
  },
  gotoLikes() {
    go("likes");
  },
  login() {
    go("login", { returnTo: "account" });
  },
});
