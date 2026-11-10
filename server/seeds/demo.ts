import { db, transaction } from "../src/common/db";
import { config } from "../src/config";
async function seed() {
  if (config.env !== "development" || !config.db.database.endsWith("_demo"))
    throw new Error("Seed only allowed in development *_demo database");
  await transaction(async (c) => {
    for (const [id, nickname, role] of [
      ["demo-member", "演示同学", "user"],
      ["demo-admin", "演示管理员", "admin"],
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
