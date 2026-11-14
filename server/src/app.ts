import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "./common/db";
import { config } from "./config";
import { ApiError, ok } from "./common/http";
import { identityRoutes } from "./modules/identity/routes";
import { postsRoutes } from "./modules/posts/routes";
import { catalogRoutes } from "./modules/catalog/routes";
import { interactionsRoutes } from "./modules/interactions/routes";
import { accountRoutes } from "./modules/account/routes";
import { adminRoutes } from "./modules/admin/routes";
import { uploadRoutes } from "./modules/uploads/routes";
export function buildApp() {
  const app = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024,
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.setErrorHandler((error, r, reply) => {
    const known = error instanceof ApiError;
    const validation = error instanceof Error && "validation" in error;
    const status = known ? error.statusCode : validation ? 400 : 503;
    reply.code(status).send({
      ok: false,
      error: {
        code: known
          ? error.code
          : validation
            ? "VALIDATION_ERROR"
            : "SERVICE_UNAVAILABLE",
        message: known
          ? error.message
          : validation
            ? "参数无效"
            : "服务暂不可用，请稍后重试",
      },
      requestId: r.id,
    });
  });
  app.setNotFoundHandler((r, reply) =>
    reply.code(404).send({
      ok: false,
      error: { code: "NOT_FOUND", message: "接口不存在" },
      requestId: r.id,
    }),
  );
  app.get("/health", async (r) => {
    await db.query("SELECT 1");
    return ok(r, { status: "ready", service: "maochumo" });
  });
  app.get("/api/v1/capabilities", async (r) =>
    ok(r, {
      wechatLogin: !!config.wxAppId && !!config.wxAppSecret,
      developmentLogin: config.env === "development" && config.devAuth,
      localUpload: config.uploadDriver === "local",
    }),
  );
  for (const routes of [
    identityRoutes,
    postsRoutes,
    catalogRoutes,
    interactionsRoutes,
    accountRoutes,
    adminRoutes,
    uploadRoutes,
  ])
    app.register(routes);
  return app;
}
