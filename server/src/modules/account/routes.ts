import { FastifyInstance } from "fastify";
import { identity, tokenHash } from "../../common/auth";
import { db, rows, transaction } from "../../common/db";
import {
  ApiError,
  ListQuery,
  listQuery,
  ok,
  paginate,
  unavailable,
} from "../../common/http";
import { idSchema } from "../../common/schemas";
import { PUBLIC_POST } from "../../common/visibility";
import { hydrate, PostRow, SELECT } from "../posts/queries";
import { Notification } from "../../../../contracts";
export async function accountRoutes(app: FastifyInstance) {
  app.put<{ Body: { nickname: string; avatarRef: string | null } }>(
    "/api/v1/me",
    {
      schema: {
        body: {
          type: "object",
          required: ["nickname", "avatarRef"],
          additionalProperties: false,
          properties: {
            nickname: { type: "string", minLength: 1, maxLength: 80 },
            avatarRef: { anyOf: [idSchema, { type: "null" }] },
          },
        },
      },
    },
    async (r) => {
      const user = await identity(r);
      const nickname = r.body.nickname.trim();
      if (!nickname) throw new ApiError(400, "INVALID_PROFILE", "昵称不能为空");
      await transaction(async (c) => {
        if (
          r.body.avatarRef &&
          !(
            await rows(
              "SELECT id FROM assets WHERE id=? AND owner_id=? AND purpose='avatar' AND status='ready' FOR SHARE",
              [r.body.avatarRef, user.id],
              c,
            )
          ).length
        )
          throw new ApiError(400, "INVALID_IMAGE", "请选择本人上传的头像");
        await c.execute("UPDATE users SET nickname=?,avatar_ref=? WHERE id=?", [
          nickname,
          r.body.avatarRef,
          user.id,
        ]);
      });
      return ok(r, { ...user, nickname, avatarRef: r.body.avatarRef });
    },
  );
  app.post("/api/v1/auth/logout", async (r) => {
    await identity(r);
    await db.execute("DELETE FROM sessions WHERE token_hash=?", [
      tokenHash(r.headers.authorization!.slice(7)),
    ]);
    return ok(r, { loggedOut: true });
  });
  for (const kind of ["posts", "likes"] as const)
    app.get<{ Querystring: ListQuery }>(
      `/api/v1/me/${kind}`,
      { schema: { querystring: listQuery } },
      async (r) => {
        const user = await identity(r),
          q = r.query;
        const condition =
          kind === "posts"
            ? "p.author_id=?"
            : "EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?)";
        const data = await rows<PostRow>(
          `${SELECT} WHERE ${PUBLIC_POST} AND ${condition} ORDER BY p.created_at DESC,p.id DESC LIMIT ${q.pageSize + 1} OFFSET ${(q.page - 1) * q.pageSize}`,
          [user.id],
        );
        return ok(
          r,
          paginate(await Promise.all(data.map((p) => hydrate(p, user.id))), q),
        );
      },
    );
  app.get<{ Querystring: ListQuery }>(
    "/api/v1/me/notifications",
    { schema: { querystring: listQuery } },
    async (r) => {
      const user = await identity(r),
        q = r.query;
      const data = await rows<
        Omit<Notification, "targetAvailable"> & { targetAvailable: number }
      >(
        `SELECT n.id,n.post_id AS postId,n.comment_id AS commentId,n.type,n.read_at AS readAt,n.created_at AS createdAt,(p.status='published') AS targetAvailable FROM notifications n JOIN posts p ON p.id=n.post_id WHERE n.recipient_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT ${q.pageSize + 1} OFFSET ${(q.page - 1) * q.pageSize}`,
        [user.id],
      );
      return ok(
        r,
        paginate(
          data.map((n) => ({
            ...n,
            readAt: n.readAt ? n.readAt.replace(" ", "T") + "Z" : null,
            createdAt: n.createdAt.replace(" ", "T") + "Z",
            targetAvailable: !!n.targetAvailable,
          })),
          q,
        ),
      );
    },
  );
  app.get("/api/v1/me/notifications/unread-count", async (r) => {
    const user = await identity(r);
    const [count] = await rows<{ count: number }>(
      "SELECT COUNT(*) AS count FROM notifications WHERE recipient_id=? AND read_at IS NULL",
      [user.id],
    );
    return ok(r, { count: Number(count.count) });
  });
  app.put("/api/v1/me/notifications/read-all", async (r) => {
    const user = await identity(r);
    await db.execute(
      "UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP(3)) WHERE recipient_id=? AND read_at IS NULL",
      [user.id],
    );
    const [count] = await rows<{ count: number }>(
      "SELECT COUNT(*) AS count FROM notifications WHERE recipient_id=? AND read_at IS NULL",
      [user.id],
    );
    return ok(r, { unreadCount: Number(count.count) });
  });
  app.put<{ Params: { notificationId: string } }>(
    "/api/v1/me/notifications/:notificationId/read",
    {
      schema: {
        params: {
          type: "object",
          required: ["notificationId"],
          properties: { notificationId: idSchema },
          additionalProperties: false,
        },
      },
    },
    async (r) => {
      const user = await identity(r);
      return transaction(async (c) => {
        const [n] = await rows(
          "SELECT id FROM notifications WHERE id=? AND recipient_id=? FOR UPDATE",
          [r.params.notificationId, user.id],
          c,
        );
        if (!n) return unavailable();
        await c.execute(
          "UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP(3)) WHERE id=? AND recipient_id=?",
          [r.params.notificationId, user.id],
        );
        const [saved] = await rows<{ readAt: string }>(
          "SELECT read_at AS readAt FROM notifications WHERE id=?",
          [r.params.notificationId],
          c,
        );
        return ok(r, {
          id: r.params.notificationId,
          readAt: saved.readAt.replace(" ", "T") + "Z",
        });
      });
    },
  );
}
