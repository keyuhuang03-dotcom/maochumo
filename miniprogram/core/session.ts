import type { Session } from "../../contracts/index";
const KEY = "maochumo.session.v1";
export function getSession(): Session | null {
  const value = wx.getStorageSync(KEY) as Session | undefined;
  if (!value || Date.parse(value.expiresAt) <= Date.now()) {
    wx.removeStorageSync(KEY);
    return null;
  }
  return value;
}
export function saveSession(session: Session) {
  wx.setStorageSync(KEY, session);
}
export function clearSession() {
  wx.removeStorageSync(KEY);
}
