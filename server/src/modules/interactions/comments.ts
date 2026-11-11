import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { Comment, CreateComment, textLength } from "../../../../contracts";
import { identity } from "../../common/auth";
import { rows } from "../../common/db";
import { once } from "../../common/idempotency";
import {
  ApiError,
  ListQuery,
  listQuery,
  ok,
  paginate,
  unavailable,
} from "../../common/http";
import { commentBody, postParams, idSchema } from "../../common/schemas";
import { assertReplyTarget } from "./guards";
const select = `SELECT c.id,c.post_id AS postId,c.body,c.reply_to_id AS replyToId,c.created_at AS createdAt,u.id AS authorId,u.nickname,u.avatar_ref AS avatarRef,u.role FROM comments c JOIN users u ON u.id=c.author_id`;
type Row = Omit<Comment, "author"> & {
  authorId: string;
  nickname: string | null;
  avatarRef: string | null;
  role: "user" | "admin";
};
const dto = (c: Row): Comment => ({
  id: c.id,
  postId: c.postId,
  body: c.body,
  replyToId: c.replyToId,
  createdAt: c.createdAt.replace(" ", "T") + "Z",
  author: {
    id: c.authorId,
    nickname: c.nickname,
    avatarRef: c.avatarRef,
    role: c.role,
  },
});
export async function commentRoutes(app: FastifyInstance) {
  app.get<{
    Params: { postId: string };
    Querystring: ListQuery & { focusId?: string };
  }>(
    "/api/v1/posts/:postId/comments",
    {
      schema: {
        params: postParams,
        querystring: {
          ...listQuery,
          properties: { ...listQuery.properties, focusId: idSchema },
        },
      },
    },
    async (r) => {
      if (
        !(
          await rows("SELECT id FROM posts WHERE id=? AND status='published'", [
            r.params.postId,
          ])
        ).length
      )
        return unavailable();
      const q = { ...r.query };
      if (q.focusId) {
        const [target] = await rows<{ createdAt: string }>(
          "SELECT created_at AS createdAt FROM comments WHERE id=? AND post_id=?",
          [q.focusId, r.params.postId],
        );
        if (!target) return unavailable();
        const [count] = await rows<{ n: number }>(
          "SELECT COUNT(*) AS n FROM comments WHERE post_id=? AND (created_at<? OR (created_at=? AND id<?))",
          [r.params.postId, target.createdAt, target.createdAt, q.focusId],
        );
        q.page = Math.floor(Number(count.n) / q.pageSize) + 1;
      }
      const data = await rows<Row>(
        `${select} WHERE c.post_id=? ORDER BY c.created_at,c.id LIMIT ${q.pageSize + 1} OFFSET ${(q.page - 1) * q.pageSize}`,
        [r.params.postId],
      );
      return ok(r, paginate(data.map(dto), q));
    },
  );
  app.post<{ Params: { postId: string }; Body: CreateComment }>(
    "/api/v1/posts/:postId/comments",
    { schema: { params: postParams, body: commentBody } },
    async (r) => {
      const user = await identity(r);
      const payload = {
        postId: r.params.postId,
        body: r.body.body.trim(),
        replyToId: r.body.replyToId,
      };
      if (!payload.body || textLength(payload.body) > 2000)
        throw new ApiError(400, "INVALID_COMMENT", "评论须为1至2000字的文字");
      const result = await once(
        user.id,
        "comments:create",
        r.body.requestKey,
        payload,
        async (c) => {
          const [post] = await rows<{ authorId: string; status: string }>(
            "SELECT author_id AS authorId,status FROM posts WHERE id=? FOR UPDATE",
            [payload.postId],
            c,
          );
          if (!post || post.status !== "published") return unavailable();
          await assertReplyTarget(c, payload.postId, payload.replyToId);
          const recipients = new Set([post.authorId]);
          if (payload.replyToId) {
            const [target] = await rows<{ authorId: string }>(
              "SELECT author_id AS authorId FROM comments WHERE id=?",
              [payload.replyToId],
              c,
            );
            recipients.add(target.authorId);
          }
          recipients.delete(user.id);
          const id = randomUUID();
          await c.execute(
            "INSERT INTO comments(id,post_id,author_id,body,reply_to_id,request_key) VALUES(?,?,?,?,?,?)",
            [
              id,
              payload.postId,
              user.id,
              payload.body,
              payload.replyToId,
              r.body.requestKey,
            ],
          );
          for (const recipient of recipients)
            await c.execute(
              "INSERT INTO notifications(id,recipient_id,post_id,comment_id,type) VALUES(?,?,?,?,?)",
              [
                randomUUID(),
                recipient,
                payload.postId,
                id,
                payload.replyToId ? "reply" : "comment",
              ],
            );
          return { id };
        },
      );
      // Replays never disclose a subsequently hidden/deleted post via its comment.
      if (
        !(
          await rows("SELECT id FROM posts WHERE id=? AND status='published'", [
            payload.postId,
          ])
        ).length
      )
        return unavailable();
      const [comment] = await rows<Row>(`${select} WHERE c.id=?`, [result.id]);
      return ok(r, dto(comment));
    },
  );
}
