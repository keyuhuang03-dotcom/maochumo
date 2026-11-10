import type { Session } from "../../contracts/index";
import { request } from "./request";
import { saveSession, getSession } from "./session";
import { go, RouteName } from "./routes";
import { env } from "./env";
export function requireLogin(returnTo: RouteName): boolean {
  if (getSession()) return true;
  go("login", { returnTo });
  return false;
}
export async function wechatLogin() {
  const code = await new Promise<string>((resolve, reject) =>
    wx.login({
      success: (r) =>
        r.code ? resolve(r.code) : reject(new Error("微信未返回凭证")),
      fail: () => reject(new Error("微信登录失败")),
    }),
  );
  const session = await request<Session>("/api/v1/auth/wechat", "POST", {
    code,
  });
  saveSession(session);
  return session;
}
export async function developmentLogin(
  key: string,
  profile: "member" | "admin" = "member",
) {
  if (!env.development) throw new Error("开发登录已禁用");
  const session = await request<Session>("/api/v1/auth/dev", "POST", {
    key,
    profile,
  });
  saveSession(session);
  return session;
}
