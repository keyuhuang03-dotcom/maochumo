import { randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { config } from "../../config";
import { db, rows, transaction } from "../../common/db";
import { identity, tokenHash } from "../../common/auth";
import { ApiError, ok, pending } from "../../common/http";
import { User } from "../../../../contracts";
import { wechat } from "./wechat";
export async function identityRoutes(app: FastifyInstance) {
  app.post<{ Body: { code: string } }>(
    "/api/v1/auth/wechat",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["code"],
          properties: {
            code: { type: "string", minLength: 1, maxLength: 256 },
          },
        },
      },
    },
    async (r) => {
      const platformId = await wechat.exchange(r.body.code);
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 86400000);
      const user = await transaction(async (c) => {
        await c.execute(
          "INSERT INTO users(id,wechat_identity,role) VALUES(?,?,'user') ON DUPLICATE KEY UPDATE id=id",
          [randomUUID(), platformId],
        );
        const [u] = await rows<User & { status: string }>(
          "SELECT id,nickname,avatar_ref AS avatarRef,role,status FROM users WHERE wechat_identity=? FOR UPDATE",
          [platformId],
          c,
        );
        if (u.status !== "active")
          throw new ApiError(403, "ACCOUNT_DISABLED", "账号已停用");
        await c.execute(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
          [tokenHash(token), u.id, expiresAt],
        );
        return {
          id: u.id,
          nickname: u.nickname,
          avatarRef: u.avatarRef,
          role: u.role,
        };
      });
      return ok(r, {
        token,
        expiresAt: expiresAt.toISOString(),
        user,
        mode: "wechat",
      });
    },
  );
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
