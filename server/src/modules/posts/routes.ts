import { FastifyInstance } from "fastify";
import { Post, Ref, User } from "../../../../contracts";
import { rows, transaction } from "../../common/db";
import { identity } from "../../common/auth";
import { PUBLIC_POST } from "../../common/visibility";
import {
  ApiError,
  ListQuery,
  listQuery,
  ok,
  paginate,
  pending,
  unavailable,
} from "../../common/http";
import { PostRow, hydrate, SELECT, findHotRows } from "./queries";
import { createPost } from "./service";
import { CreatePost } from "../../../../contracts";
import { postBody, postParams } from "../../common/schemas";
export async function postsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListQuery }>(
    "/api/v1/posts",
    { schema: { querystring: listQuery } },
    async (r) => {
      const userId = r.headers.authorization
        ? (await identity(r)).id
        : undefined;
      const q = r.query;
      const where = [PUBLIC_POST];
      const args: (string | number)[] = [];
      if (q.catId) {
        where.push(
          "EXISTS (SELECT 1 FROM post_cats pc WHERE pc.post_id=p.id AND pc.cat_id=?)",
        );
        args.push(q.catId);
      }
      if (q.topicId) {
        where.push(
          "EXISTS (SELECT 1 FROM post_topics pt WHERE pt.post_id=p.id AND pt.topic_id=?)",
        );
        args.push(q.topicId);
      }
      if (q.q) {
        where.push(
          "(p.body LIKE ? OR EXISTS(SELECT 1 FROM post_topics pt JOIN topics t ON t.id=pt.topic_id WHERE pt.post_id=p.id AND t.name LIKE ?) OR EXISTS(SELECT 1 FROM post_cats pc JOIN cats c ON c.id=pc.cat_id WHERE pc.post_id=p.id AND c.name LIKE ?))",
        );
        args.push(...Array(3).fill("%" + q.q + "%"));
      }
      const data = await rows<PostRow>(
        `${SELECT} WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC,p.id DESC LIMIT ${q.pageSize + 1} OFFSET ${(q.page - 1) * q.pageSize}`,
        args,
      );
      return ok(
        r,
        paginate(await Promise.all(data.map((p) => hydrate(p, userId))), q),
      );
    },
  );
  app.get("/api/v1/posts/hot", async (r) => {
    const asOf = new Date();
    const userId = r.headers.authorization ? (await identity(r)).id : undefined;
    const data = await findHotRows(asOf);
    return ok(r, {
      items: await Promise.all(data.map((p) => hydrate(p, userId))),
      asOf: asOf.toISOString(),
    });
  });
  app.get<{ Params: { postId: string } }>(
    "/api/v1/posts/:postId",
    async (r) => {
      const [post] = await rows<PostRow>(
        `${SELECT} WHERE ${PUBLIC_POST} AND p.id=?`,
        [r.params.postId],
      );
      if (!post) return unavailable();
      return ok(
        r,
        await hydrate(
          post,
          r.headers.authorization ? (await identity(r)).id : undefined,
        ),
      );
    },
  );
  app.post<{ Body: CreatePost }>(
    "/api/v1/posts",
    { schema: { body: postBody } },
    async (r) => {
      const user = await identity(r);
      const result = await createPost(user.id, r.body);
      const [post] = await rows<PostRow>(
        `${SELECT} WHERE ${PUBLIC_POST} AND p.id=?`,
        [result.id],
      );
      if (!post) return unavailable();
      return ok(r, await hydrate(post, user.id));
    },
  );
  app.delete<{ Params: { postId: string } }>(
    "/api/v1/posts/:postId",
    async (r) => {
      const user = await identity(r);
      return transaction(async (c) => {
        const [p] = await rows<{ authorId: string; status: string }>(
          "SELECT author_id AS authorId,status FROM posts WHERE id=? FOR UPDATE",
          [r.params.postId],
          c,
        );
        if (!p) return unavailable();
        if (p.authorId !== user.id)
          throw new ApiError(403, "FORBIDDEN", "只能删除本人帖子");
        if (p.status === "hidden")
          throw new ApiError(409, "POLICY_PENDING", "隐藏帖作者操作范围待确认");
        await c.execute(
          "UPDATE posts SET status='deleted' WHERE id=? AND author_id=?",
          [r.params.postId, user.id],
        );
        return ok(r, { id: r.params.postId, status: "deleted" });
      });
    },
  );
}
