import type { ApiResult, UploadResult } from "../../contracts/index";
import { getSession, clearSession } from "./session";
import { env } from "./env";
import { RequestError } from "./request";
export function uploadImage(
  filePath: string,
  purpose: "post" | "avatar" | "cat" = "post",
): Promise<UploadResult> {
  const token = getSession()?.token;
  if (!token)
    return Promise.reject(new RequestError("请先登录", "UNAUTHORIZED"));
  return new Promise((resolve, reject) =>
    wx.uploadFile({
      url: env.apiBase + "/api/v1/uploads?purpose=" + purpose,
      filePath,
      name: "file",
      timeout: 30000,
      header: { Authorization: "Bearer " + token },
      success(response) {
        if (response.statusCode === 401) clearSession();
        try {
          const result = JSON.parse(response.data) as ApiResult<UploadResult>;
          if (
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            result.ok
          )
            return resolve(result.data);
          if (!result.ok)
            return reject(
              new RequestError(
                result.error.message,
                result.error.code,
                result.requestId,
              ),
            );
        } catch {}
        reject(new RequestError("上传响应异常，请重试", "INVALID_RESPONSE"));
      },
      fail() {
        reject(
          new RequestError("图片上传失败，已保留输入，请重试", "NETWORK_ERROR"),
        );
      },
    }),
  );
}
