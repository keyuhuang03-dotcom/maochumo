import { config } from "../../config";
import { ApiError } from "../../common/http";
export const wechat = {
  async exchange(code: string): Promise<string> {
    if (!config.wxAppId || !config.wxAppSecret)
      throw new ApiError(
        503,
        "WECHAT_NOT_CONFIGURED",
        "请在服务端配置微信AppID和AppSecret",
      );
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.search = new URLSearchParams({
      appid: config.wxAppId,
      secret: config.wxAppSecret,
      js_code: code,
      grant_type: "authorization_code",
    }).toString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Platform unavailable");
      const result = (await response.json()) as {
        openid?: string;
        errcode?: number;
      };
      if (result.errcode)
        throw new ApiError(
          result.errcode === 40029 || result.errcode === 40163 ? 401 : 503,
          "WECHAT_LOGIN_FAILED",
          "微信登录失败，请重新获取登录凭证",
        );
      if (
        typeof result.openid !== "string" ||
        !result.openid ||
        result.openid.length > 100
      )
        throw new Error("Invalid platform response");
      return config.wxAppId + ":" + result.openid;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        "WECHAT_UNAVAILABLE",
        "微信服务暂不可用，请稍后重试",
      );
    }
  },
};
