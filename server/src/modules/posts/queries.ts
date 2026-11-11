import { Post, Ref, User } from "../../../../contracts";
import { rows } from "../../common/db";
import { imageUrl } from "../uploads/storage";
export interface PostRow {
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
export async function hydrate(p: PostRow, userId?: string): Promise<Post> {
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
    images: images.map((i) => imageUrl(i.imageRef)),
    likeCount: Number(p.likeCount),
    commentCount: Number(p.commentCount),
    liked,
  };
}
export const SELECT = `SELECT p.id,p.body,p.created_at AS createdAt,u.id AS authorId,u.nickname,u.avatar_ref AS avatarRef,u.role,(SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likeCount,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS commentCount FROM posts p JOIN users u ON u.id=p.author_id`;

export function findHotRows(asOf: Date) {
  return rows<PostRow>(
    `${SELECT} WHERE p.status='published' AND p.created_at BETWEEN ? AND ? ORDER BY likeCount DESC,commentCount DESC,p.created_at DESC,p.id DESC LIMIT 10`,
    [new Date(asOf.getTime() - 7 * 86400000), asOf],
  );
}
