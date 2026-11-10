import { createHash } from "node:crypto";
import { FastifyRequest } from "fastify";
import { User } from "../../../contracts";
import { rows } from "./db";
import { ApiError } from "./http";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function identity(r: FastifyRequest): Promise<User> {
  const token = r.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "请先登录");
  const [user] = await rows<User>(
    `SELECT u.id,u.nickname,u.avatar_ref AS avatarRef,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.status='active'`,
    [tokenHash(token)],
  );
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "登录已失效");
  return user;
}
export async function admin(r: FastifyRequest) {
  const user = await identity(r);
  if (user.role !== "admin")
    throw new ApiError(403, "FORBIDDEN", "需要管理员权限");
  return user;
}
