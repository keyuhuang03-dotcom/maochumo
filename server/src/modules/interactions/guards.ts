import { PoolConnection } from "mysql2/promise";
import { rows } from "../../common/db";
import { ApiError } from "../../common/http";
/** Required inside the future comment+notification transaction; do not rely on a self-reference FK alone. */
export async function assertReplyTarget(
  c: PoolConnection,
  postId: string,
  replyToId: string | null,
) {
  if (replyToId === null) return;
  const [target] = await rows<{ id: string }>(
    "SELECT id FROM comments WHERE id=? AND post_id=? FOR SHARE",
    [replyToId, postId],
    c,
  );
  if (!target)
    throw new ApiError(400, "INVALID_REPLY_TARGET", "回复目标必须属于当前帖子");
}
