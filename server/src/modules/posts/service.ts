import { randomUUID } from "node:crypto";
import { CreatePost, textLength } from "../../../../contracts";
import { rows } from "../../common/db";
import { once } from "../../common/idempotency";
import { ApiError } from "../../common/http";
export async function createPost(actor: string, input: CreatePost) {
  const payload = {
    body: input.body,
    imageRefs: input.imageRefs,
    catIds: [...input.catIds].sort(),
    topicIds: [...input.topicIds].sort(),
  };
  if (
    textLength(payload.body) > 2000 ||
    (!payload.body.trim() && !payload.imageRefs.length)
  )
    throw new ApiError(
      400,
      "INVALID_POST",
      "正文和图片至少一项，正文最多2000字",
    );
  return once(actor, "posts:create", input.requestKey, payload, async (c) => {
    for (const id of payload.catIds)
      if (
        !(await rows("SELECT id FROM cats WHERE id=? FOR SHARE", [id], c))
          .length
      )
        throw new ApiError(400, "INVALID_CAT", "所选猫咪档案不存在");
    for (const id of payload.topicIds)
      if (
        !(
          await rows(
            "SELECT id FROM topics WHERE id=? AND status='active' FOR SHARE",
            [id],
            c,
          )
        ).length
      )
        throw new ApiError(400, "INVALID_TOPIC", "所选话题不可用");
    for (const id of payload.imageRefs)
      if (
        !(
          await rows(
            "SELECT id FROM assets WHERE id=? AND owner_id=? AND purpose='post' AND status='ready' FOR SHARE",
            [id, actor],
            c,
          )
        ).length
      )
        throw new ApiError(
          400,
          "INVALID_IMAGE",
          "图片尚未上传、用途不符或不属于当前用户",
        );
    const id = randomUUID();
    await c.execute(
      "INSERT INTO posts(id,author_id,body,request_key) VALUES(?,?,?,?)",
      [id, actor, payload.body, input.requestKey],
    );
    for (const cat of payload.catIds)
      await c.execute("INSERT INTO post_cats(post_id,cat_id) VALUES(?,?)", [
        id,
        cat,
      ]);
    for (const topic of payload.topicIds)
      await c.execute("INSERT INTO post_topics(post_id,topic_id) VALUES(?,?)", [
        id,
        topic,
      ]);
    for (const [order, image] of payload.imageRefs.entries())
      await c.execute(
        "INSERT INTO post_images(post_id,image_ref,sort_order) VALUES(?,?,?)",
        [id, image, order],
      );
    return { id };
  });
}
