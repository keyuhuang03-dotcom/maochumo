import { randomBytes, timingSafeEqual } from "node:crypto";
import { FastifyInstance } from "fastify";
import { config } from "../../config";
import { db, rows } from "../../common/db";
import { identity, tokenHash } from "../../common/auth";
import { ApiError, ok, pending } from "../../common/http";
import { User } from "../../../../contracts";
export async function identityRoutes(app: FastifyInstance) {
  app.post("/api/v1/auth/wechat", async () => {
    throw new ApiError(
      503,
      "WECHAT_NOT_CONFIGURED",
      "真实微信登录适配器尚未接入",
    );
  });
  app.post<{ Body: { profile: "member" | "admin"; key: string } }>(
    "/api/v1/auth/dev",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["profile", "key"],
          properties: {
            profile: { enum: ["member", "admin"] },
            key: { type: "string", maxLength: 256 },
          },
        },
      },
    },
    async (r) => {
      if (!config.devAuth)
        throw new ApiError(404, "NOT_FOUND", "开发登录未启用");
      const key = Buffer.from(r.body.key);
      const expected = Buffer.from(config.devKey);
      if (key.length !== expected.length || !timingSafeEqual(key, expected))
        throw new ApiError(403, "FORBIDDEN", "开发密钥不匹配");
      const [user] = await rows<User>(
        "SELECT id,nickname,avatar_ref AS avatarRef,role FROM users WHERE id=? AND status='active'",
        [r.body.profile === "admin" ? "demo-admin" : "demo-member"],
      );
      if (!user) throw new ApiError(503, "SEED_REQUIRED", "请先运行演示种子");
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000);
      await db.execute(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
        [tokenHash(token), user.id, expiresAt],
      );
      return ok(r, {
        token,
        expiresAt: expiresAt.toISOString(),
        user,
        mode: "development",
      });
    },
  );
  app.get("/api/v1/me", async (r) => ok(r, await identity(r)));
  app.put("/api/v1/me", async (r) => {
    await identity(r);
    return pending();
  });
}
