import type { ApiResult } from "../../contracts/index";
import { env } from "./env";
import { getSession, clearSession } from "./session";
export class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public requestId = "",
  ) {
    super(message);
  }
}
export function request<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  data?: object,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = getSession()?.token;
    wx.request<ApiResult<T>>({
      url: env.apiBase + path,
      method,
      data,
      timeout: 10000,
      header: {
        ...(data !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      success(response) {
        const result = response.data;
        if (response.statusCode === 401) clearSession();
        if (
          response.statusCode >= 200 &&
          response.statusCode < 300 &&
          result?.ok === true
        )
          return resolve(result.data);
        if (result?.ok === false)
          return reject(
            new RequestError(
              result.error.message,
              result.error.code,
              result.requestId,
            ),
          );
        reject(new RequestError("服务响应异常，请重试", "INVALID_RESPONSE"));
      },
      fail(error) {
        reject(
          new RequestError(
            method === "GET"
              ? env.development &&
                /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(env.apiBase)
                ? "本机后端未连接。请在电脑双击“启动猫出没.command”，保持窗口打开后再重试。"
                : "网络连接失败，请检查网络后重试"
              : "网络中断，操作结果未知；请保留输入并使用原请求标识重试",
            "NETWORK_ERROR",
          ),
        );
      },
    });
  });
}
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "请求失败，请重试";
