import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { localStorage } from "../src/modules/uploads/storage";
import { db, transaction } from "../src/common/db";
import { config } from "../src/config";
async function seed() {
  if (config.env !== "development" || !config.db.database.endsWith("_demo"))
    throw new Error("Seed only allowed in development *_demo database");
  await transaction(async (c) => {
    for (const [id, nickname, role] of [
      ["demo-member", "演示同学", "user"],
      ["demo-admin", "演示管理员", "admin"],
      ["demo-story-author", "芝士奶盖（演示）", "user"],
      ["demo-story-reader", "小鱼干（演示）", "user"],
    ])
      await c.execute(
        "INSERT INTO users(id,nickname,role) VALUES(?,?,?) ON DUPLICATE KEY UPDATE id=id",
        [id, nickname, role],
      );
    for (const [id, name, x] of [
      ["demo-area-library", "示例图书馆", 0.1],
      ["demo-area-garden", "示例花园", 0.6],
      ["demo-area-empty", "示例空区域", 0.35],
    ] as const)
      await c.execute(
        "INSERT INTO areas(id,name,region) VALUES(?,?,?) ON DUPLICATE KEY UPDATE id=id",
        [id, name, JSON.stringify({ x, y: 0.2, width: 0.22, height: 0.3 })],
      );
    for (const [id, area] of [
      ["demo-cat-1", "demo-area-library"],
      ["demo-cat-2", "demo-area-garden"],
    ])
      await c.execute(
        "INSERT INTO cats(id,name,area_id,aliases,photo_refs,appearance,personality) VALUES(?,'橘子',?,?,?,'演示档案，尚未核验','仅为示例，不代表实际性格') ON DUPLICATE KEY UPDATE id=id",
        [id, area, JSON.stringify(["小橘"]), JSON.stringify([])],
      );
    await c.execute(
      "INSERT INTO topics(id,name) VALUES('demo-topic','校园日常') ON DUPLICATE KEY UPDATE id=id",
    );
    for (const [id, status, body] of [
      [
        "demo-post-public",
        "published",
        "欢迎来到猫出没。这条演示帖子由 MySQL 返回；两只同名猫通过不同 ID 关联。",
      ],
      ["demo-post-hidden", "hidden", "隐藏样例，不应公开"],
      ["demo-post-deleted", "deleted", "删除样例，不应公开"],
    ])
      await c.execute(
        "INSERT INTO posts(id,author_id,body,status,request_key) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
        [id, "demo-member", body, status, id],
      );
    for (const [id, body, cats] of [
      [
        "demo-story-library",
        "下课路过图书馆，橘子正趴在石阶上晒太阳。有人从旁边经过，它只抬了抬耳朵，又把脸埋进爪子里。",
        ["demo-cat-1"],
      ],
      [
        "demo-story-rain",
        "午后的雨刚停，花园的小橘从长椅底下钻了出来。它踩着没积水的砖一路走，最后在灌木旁甩了甩尾巴。",
        ["demo-cat-2"],
      ],
      [
        "demo-story-sun",
        "今天路过花园，看见橘子和一只黑猫挨着晒太阳。橘子睡得四脚朝天，黑猫在旁边眯眼，谁也没挪窝。\n（演示文案与生成配图）",
        ["demo-cat-2"],
      ],
    ] as const) {
      await c.execute(
        "INSERT INTO posts(id,author_id,body,request_key) VALUES(?,'demo-story-author',?,?) ON DUPLICATE KEY UPDATE id=id",
        [id, body, id],
      );
      for (const cat of cats)
        await c.execute(
          "INSERT INTO post_cats(post_id,cat_id) VALUES(?,?) ON DUPLICATE KEY UPDATE post_id=post_id",
          [id, cat],
        );
      await c.execute(
        "INSERT INTO post_topics VALUES(?,'demo-topic') ON DUPLICATE KEY UPDATE post_id=post_id",
        [id],
      );
    }
    if (config.uploadDriver === "local") {
      for (const index of [0, 1, 2]) {
        const id = `demo-story-sun-photo-${index}`;
        const key = `a3f17f84-3b96-4eef-8afd-923760aa039${index}.png`;
        const bytes = await readFile(
          join("server", "seeds", "assets", `sun-${index}.png`),
        );
        try {
          await localStorage.put(key, bytes);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
        await c.execute(
          "INSERT INTO assets(id,owner_id,purpose,storage_key,mime_type,byte_size,status) VALUES(?,'demo-story-author','post',?,'image/png',?,'ready') ON DUPLICATE KEY UPDATE id=id",
          [id, key, bytes.length],
        );
        await c.execute(
          "INSERT INTO post_images(post_id,image_ref,sort_order) VALUES('demo-story-sun',?,?) ON DUPLICATE KEY UPDATE post_id=post_id",
          [id, index],
        );
      }
    }
    for (const [id, author, body, replyTo] of [
      [
        "demo-story-comment",
        "demo-story-reader",
        "它们还在花园靠长椅的那边吗？我昨天路过只见到了橘子。",
        null,
      ],
      [
        "demo-story-reply",
        "demo-story-author",
        "对，就在花园那边。我下午路过时两只都在。",
        "demo-story-comment",
      ],
    ] as const)
      await c.execute(
        "INSERT INTO comments(id,post_id,author_id,body,reply_to_id,request_key) VALUES(?,'demo-story-sun',?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
        [id, author, body, replyTo, id],
      );
    await c.execute(
      "INSERT INTO likes(user_id,post_id) VALUES('demo-story-reader','demo-story-sun') ON DUPLICATE KEY UPDATE user_id=user_id",
    );
    for (const cat of ["demo-cat-1", "demo-cat-2"])
      await c.execute(
        "INSERT INTO post_cats(post_id,cat_id) VALUES('demo-post-public',?) ON DUPLICATE KEY UPDATE post_id=post_id",
        [cat],
      );
    await c.execute(
      "INSERT INTO post_topics VALUES('demo-post-public','demo-topic') ON DUPLICATE KEY UPDATE post_id=post_id",
    );
  });
  console.log("Demo seed complete (existing records preserved).");
}
seed()
  .catch(() => {
    console.error("Seed failed; transaction rolled back.");
    process.exitCode = 1;
  })
  .finally(() => db.end());
