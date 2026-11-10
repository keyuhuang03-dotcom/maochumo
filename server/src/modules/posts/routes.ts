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
interface PostRow {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  nickname: string | null;
  avatarRef: string | null;
  role: User["role"];
  likeCount: number;
  commentCount: number;
}
async function hydrate(p: PostRow, userId?: string): Promise<Post> {
  const liked = userId
    ? (
        await rows("SELECT 1 FROM likes WHERE user_id=? AND post_id=?", [
          userId,
          p.id,
        ])
      ).length > 0
    : false;
  const cats = await rows<Ref>(
    "SELECT c.id,c.name FROM cats c JOIN post_cats pc ON pc.cat_id=c.id WHERE pc.post_id=? ORDER BY c.id",
    [p.id],
  );
  const topics = await rows<Ref>(
    "SELECT t.id,t.name FROM topics t JOIN post_topics pt ON pt.topic_id=t.id WHERE pt.post_id=? ORDER BY t.id",
    [p.id],
  );
  const images = await rows<{ imageRef: string }>(
    "SELECT image_ref AS imageRef FROM post_images WHERE post_id=? ORDER BY sort_order",
    [p.id],
  );
  return {
    id: p.id,
    body: p.body,
    createdAt: p.createdAt.replace(" ", "T") + "Z",
    author: {
      id: p.authorId,
      nickname: p.nickname,
      avatarRef: p.avatarRef,
      role: p.role,
    },
    cats,
    topics,
    images: images.map((i) => i.imageRef),
    likeCount: Number(p.likeCount),
    commentCount: Number(p.commentCount),
    liked,
  };
}
const SELECT = `SELECT p.id,p.body,p.created_at AS createdAt,u.id AS authorId,u.nickname,u.avatar_ref AS avatarRef,u.role,(SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likeCount,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS commentCount FROM posts p JOIN users u ON u.id=p.author_id`;
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
  app.get("/api/v1/posts/hot", async () => pending());
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
  app.post("/api/v1/posts", async (r) => {
    await identity(r);
    return pending();
  });
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
