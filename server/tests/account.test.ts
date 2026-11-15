import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app";
import { db, rows } from "../src/common/db";
import { tokenHash } from "../src/common/auth";
const app = buildApp(),
  prefix = "account-" + randomUUID();
const users = [prefix + "a", prefix + "b"],
  tokens = [randomUUID(), randomUUID()];
const posts = [
  prefix + "-public",
  prefix + "-hidden",
  prefix + "-deleted",
  prefix + "-other",
];
const notices = [prefix + "-n1", prefix + "-n2", prefix + "-n3"];
const assets = [
  prefix + "-avatar",
  prefix + "-foreign",
  prefix + "-post-image",
];
const auth = (i = 0) => ({ authorization: "Bearer " + tokens[i] });
const get = (path: string, i = 0) =>
  app.inject({ url: "/api/v1" + path, headers: auth(i) });
const put = (path: string, payload: object = {}, i = 0) =>
  app.inject({
    method: "PUT",
    url: "/api/v1" + path,
    headers: auth(i),
    payload,
  });
before(async () => {
  for (let i = 0; i < 2; i++) {
    await db.execute("INSERT INTO users(id,nickname) VALUES(?,?)", [
      users[i],
      "account test",
    ]);
    await db.execute(
      "INSERT INTO sessions VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
      [tokenHash(tokens[i]), users[i]],
    );
  }
  for (let i = 0; i < 4; i++) {
    await db.execute(
      "INSERT INTO posts(id,author_id,body,status,request_key) VALUES(?,?,?,?,?)",
      [
        posts[i],
        users[i === 3 ? 1 : 0],
        "private-body-" + i,
        ["published", "hidden", "deleted", "published"][i],
        posts[i],
      ],
    );
    await db.execute("INSERT INTO likes(user_id,post_id) VALUES(?,?)", [
      users[0],
      posts[i],
    ]);
  }
  for (let i = 0; i < 3; i++) {
    await db.execute(
      "INSERT INTO comments(id,post_id,author_id,body,request_key) VALUES(?,?,?,?,?)",
      [notices[i], posts[i], users[1], "comment", notices[i]],
    );
    await db.execute(
      "INSERT INTO notifications(id,recipient_id,post_id,comment_id,type) VALUES(?,?,?,?,'comment')",
      [notices[i], users[0], posts[i], notices[i]],
    );
  }
  for (let i = 0; i < 3; i++)
    await db.execute(
      "INSERT INTO assets(id,owner_id,purpose,storage_key,mime_type,byte_size,status) VALUES(?,?,?,?, 'image/png',1,'ready')",
      [
        assets[i],
        users[i === 1 ? 1 : 0],
        i === 2 ? "post" : "avatar",
        assets[i] + ".png",
      ],
    );
});
after(async () => {
  for (const post of posts) {
    await db.execute("DELETE FROM notifications WHERE post_id=?", [post]);
    await db.execute("DELETE FROM comments WHERE post_id=?", [post]);
    await db.execute("DELETE FROM likes WHERE post_id=?", [post]);
    await db.execute("DELETE FROM posts WHERE id=?", [post]);
  }
  for (const u of users) {
    await db.execute("DELETE FROM assets WHERE owner_id=?", [u]);
    await db.execute("DELETE FROM sessions WHERE user_id=?", [u]);
    await db.execute("DELETE FROM users WHERE id=?", [u]);
  }
  await app.close();
  await db.end();
});
test("account queries require identity, scope to owner and exclude hidden/deleted content", async () => {
  assert.equal((await app.inject("/api/v1/me/posts")).statusCode, 401);
  assert.equal((await get("/me/posts?userId=" + users[1])).statusCode, 400);
  const mine = (await get("/me/posts")).json().data;
  assert.deepEqual(
    mine.items.map((p: any) => p.id),
    [posts[0]],
  );
  const liked = (await get("/me/likes")).json().data;
  assert.deepEqual(
    new Set(liked.items.map((p: any) => p.id)),
    new Set([posts[0], posts[3]]),
  );
  assert.deepEqual((await get("/me/likes", 1)).json().data.items, []);
  const paged = (await get("/me/likes?pageSize=1")).json().data;
  assert.equal(paged.items.length, 1);
  assert.equal(paged.hasMore, true);
});
test("notifications expose availability only, read operations are owner-scoped and idempotent", async () => {
  const list = (await get("/me/notifications")).json().data.items;
  assert.equal(list.length, 3);
  assert.equal(list.filter((n: any) => n.targetAvailable).length, 1);
  assert(!JSON.stringify(list).includes("private-body"));
  assert.equal(
    (await get("/me/notifications/unread-count")).json().data.count,
    3,
  );
  assert.equal(
    (await put("/me/notifications/" + notices[0] + "/read", {}, 1)).statusCode,
    404,
  );
  const path = "/me/notifications/" + notices[0] + "/read";
  assert.equal((await put(path)).statusCode, 200);
  const first = (
    await rows<{ at: string }>(
      "SELECT read_at AS at FROM notifications WHERE id=?",
      [notices[0]],
    )
  )[0].at;
  for (const result of await Promise.all(
    Array.from({ length: 4 }, () => put(path)),
  ))
    assert.equal(result.statusCode, 200);
  assert.equal(
    (
      await rows<{ at: string }>(
        "SELECT read_at AS at FROM notifications WHERE id=?",
        [notices[0]],
      )
    )[0].at,
    first,
  );
  assert.equal(
    (await get("/me/notifications/unread-count")).json().data.count,
    2,
  );
  await Promise.all([
    put("/me/notifications/read-all"),
    put("/me/notifications/read-all"),
  ]);
  assert.equal(
    (await get("/me/notifications/unread-count")).json().data.count,
    0,
  );
  assert.equal((await get("/me/notifications")).json().data.items.length, 3);
});
test("profile writes validate nickname, avatar purpose and ownership without accepting roles", async () => {
  assert.equal(
    (await put("/me", { nickname: "x", avatarRef: assets[1] })).statusCode,
    400,
  );
  assert.equal(
    (await put("/me", { nickname: "x", avatarRef: assets[2] })).statusCode,
    400,
  );
  assert.equal(
    (await put("/me", { nickname: "   ", avatarRef: null })).statusCode,
    400,
  );
  assert.equal(
    (await put("/me", { nickname: "x", avatarRef: null, role: "admin" }))
      .statusCode,
    400,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await put("/me", { nickname: " 更新昵称 ", avatarRef: assets[0] }))
        .statusCode,
      200,
    );
  const user = (await get("/me")).json().data;
  assert.equal(user.nickname, "更新昵称");
  assert.equal(user.role, "user");
  assert.equal(user.avatarRef, assets[0]);
  await put("/me", { nickname: "更新昵称", avatarRef: null });
});
test("logout revokes the server session", async () => {
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: auth(1),
      })
    ).statusCode,
    200,
  );
  assert.equal((await get("/me", 1)).statusCode, 401);
});
