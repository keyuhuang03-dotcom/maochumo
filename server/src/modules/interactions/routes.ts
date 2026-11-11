import { FastifyInstance } from "fastify";
import { identity } from "../../common/auth";
import { rows, transaction } from "../../common/db";
import { ok, pending, unavailable } from "../../common/http";
import { commentRoutes } from "./comments";
export async function interactionsRoutes(app: FastifyInstance) {
  app.put<{ Params: { postId: string }; Body: { liked: boolean } }>(
    "/api/v1/posts/:postId/like",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["liked"],
          properties: { liked: { type: "boolean" } },
        },
      },
    },
    async (r) => {
      const user = await identity(r);
      return transaction(async (c) => {
        const [p] = await rows<{ status: string }>(
          "SELECT status FROM posts WHERE id=? FOR UPDATE",
          [r.params.postId],
          c,
        );
        if (!p || p.status !== "published") return unavailable();
        if (r.body.liked)
          await c.execute(
            "INSERT INTO likes(user_id,post_id) VALUES(?,?) ON DUPLICATE KEY UPDATE user_id=user_id",
            [user.id, r.params.postId],
          );
        else
          await c.execute("DELETE FROM likes WHERE user_id=? AND post_id=?", [
            user.id,
            r.params.postId,
          ]);
        const [count] = await rows<{ n: number }>(
          "SELECT COUNT(*) AS n FROM likes WHERE post_id=?",
          [r.params.postId],
          c,
        );
        return ok(r, { liked: r.body.liked, likeCount: Number(count.n) });
      });
    },
  );
  await commentRoutes(app);
}
