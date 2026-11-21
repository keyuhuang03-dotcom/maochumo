import { getSession } from "../../core/session";
import { RequestError } from "../../core/request";
import { resultUnknown } from "../../core/submission";
export interface PendingAdmin<T> {
  id: string;
  input: T;
}
const key = (scope: string, actor: string) =>
  "maochumo.admin.pending." + actor + "." + scope;
export function pendingAdmin<T>(scope: string): PendingAdmin<T> | null {
  const actor = getSession()?.user.id;
  return actor ? wx.getStorageSync(key(scope, actor)) || null : null;
}
export async function submitAdmin<T, R>(
  scope: string,
  id: string,
  input: T,
  send: (id: string, input: T) => Promise<R>,
): Promise<R> {
  const session = getSession();
  if (!session) throw new RequestError("请先登录", "UNAUTHORIZED");
  const storageKey = key(scope, session.user.id);
  const pending: PendingAdmin<T> = wx.getStorageSync(storageKey) || {
    id,
    input,
  };
  // Save before sending: an unknown result survives leaving/reopening the page.
  wx.setStorageSync(storageKey, pending);
  let result: R;
  try {
    result = await send(pending.id, pending.input);
  } catch (e) {
    if (
      !resultUnknown(e) &&
      !(e instanceof RequestError && e.code === "IDEMPOTENCY_CONFLICT")
    )
      wx.removeStorageSync(storageKey);
    throw e;
  }
  wx.removeStorageSync(storageKey);
  if (getSession()?.token !== session.token)
    throw new RequestError("登录身份已变化，请重新加载", "SESSION_CHANGED");
  return result;
}
export const pendingMessage =
  "保存结果尚未确认，请重试原请求；确认前暂不能修改内容。";
