import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import sharp from "sharp";
import { buildApp } from "../src/app";
import { db, rows } from "../src/common/db";
import { tokenHash } from "../src/common/auth";
import { config } from "../src/config";
import { findHotRows } from "../src/modules/posts/queries";
import { wechat } from "../src/modules/identity/wechat";
const app = buildApp();
const prefix = "owner-" + randomUUID();
const users = [prefix + "a", prefix + "b", prefix + "c"];
const tokens = users.map(() => randomBytes(32).toString("hex"));
const auth = (i = 0) => ({ authorization: "Bearer " + tokens[i] });
const posts: string[] = [];
const assetIds: string[] = [];
const createdUsers: string[] = [];
let image: Buffer;
let imageRef = "";
let firstPost = "";
let firstComment = "";
const makePost = (body = "Owner test") => ({
  body,
  imageRefs: [] as string[],
  catIds: [] as string[],
  topicIds: [] as string[],
  requestKey: randomUUID(),
});
const comment = (body = "Comment", replyToId: string | null = null) => ({
  body,
  replyToId,
  requestKey: randomUUID(),
});
const send = (url: string, payload: object, i = 0) =>
  app.inject({ method: "POST", url, headers: auth(i), payload });
const upload = async (bytes: Buffer, purpose = "post", i = 0) => {
  const boundary = "owner-test-boundary";
  return app.inject({
    method: "POST",
    url: "/api/v1/uploads?purpose=" + purpose,
    headers: {
      ...auth(i),
      "content-type": "multipart/form-data; boundary=" + boundary,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
};
before(async () => {
  config.uploadDriver = "local";
  config.uploadDir = ".local/tests/" + prefix;
  for (const [i, id] of users.entries()) {
    await db.execute("INSERT INTO users(id,nickname) VALUES(?,?)", [
      id,
      "Owner test " + i,
    ]);
    await db.execute(
      "INSERT INTO sessions VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
      [tokenHash(tokens[i]), id],
    );
  }
  image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#c49052" },
  })
    .png()
    .toBuffer();
});
after(async () => {
  for (const id of users) {
    await db.execute("DELETE FROM notifications WHERE recipient_id=?", [id]);
  }
  for (const id of posts) {
    await db.execute("DELETE FROM notifications WHERE post_id=?", [id]);
    await db.execute("UPDATE comments SET reply_to_id=NULL WHERE post_id=?", [
      id,
    ]);
    await db.execute("DELETE FROM comments WHERE post_id=?", [id]);
    await db.execute("DELETE FROM likes WHERE post_id=?", [id]);
    await db.execute("DELETE FROM post_images WHERE post_id=?", [id]);
    await db.execute("DELETE FROM post_cats WHERE post_id=?", [id]);
    await db.execute("DELETE FROM post_topics WHERE post_id=?", [id]);
    await db.execute("DELETE FROM posts WHERE id=?", [id]);
  }
  for (const id of [...users, ...createdUsers]) {
    await db.execute("DELETE FROM idempotency_keys WHERE actor_id=?", [id]);
    await db.execute("DELETE FROM sessions WHERE user_id=?", [id]);
    await db.execute("DELETE FROM assets WHERE owner_id=?", [id]);
    await db.execute("DELETE FROM users WHERE id=?", [id]);
  }
  await app.close();
  await db.end();
  await rm(config.uploadDir, { recursive: true, force: true });
});
test("real image upload decodes content, rejects spoof/size and limits draft access", async () => {
  const result = await upload(image);
  assert.equal(result.statusCode, 200, result.body);
  imageRef = result.json().data.imageRef;
  assetIds.push(imageRef);
  assert.equal((await app.inject("/api/v1/media/" + imageRef)).statusCode, 404);
  const own = await app.inject({
    url: "/api/v1/media/" + imageRef,
    headers: auth(),
  });
  assert.equal(own.statusCode, 200);
  assert.equal((await sharp(own.rawPayload).metadata()).format, "png");
  assert.equal(own.headers["cache-control"], "no-store");
  assert.equal(
    (await app.inject({ url: "/api/v1/media/" + imageRef, headers: auth(1) }))
      .statusCode,
    404,
  );
  assert.equal(
    (await upload(Buffer.from("<svg><script>alert(1)</script></svg>")))
      .statusCode,
    400,
  );
  assert.equal(
    (await upload(Buffer.alloc(8 * 1024 * 1024 + 1))).statusCode,
    400,
  );
  assert.equal((await upload(image, "cat", 1)).statusCode, 403);
});
test("publish transaction persists optional many-to-many, handles parallel retries, rejects payload changes", async () => {
  const payload = {
    ...makePost("测试正文 " + prefix),
    imageRefs: [imageRef],
    catIds: ["demo-cat-1", "demo-cat-2"],
    topicIds: ["demo-topic"],
  };
  const results = await Promise.all(
    Array.from({ length: 5 }, () => send("/api/v1/posts", payload)),
  );
  for (const r of results) assert.equal(r.statusCode, 200, r.body);
  firstPost = results[0].json().data.id;
  posts.push(firstPost);
  assert(results.every((r) => r.json().data.id === firstPost));
  assert.equal(results[0].json().data.cats.length, 2);
  assert.equal(
    (
      await rows<{ n: number }>(
        "SELECT COUNT(*) AS n FROM posts WHERE author_id=? AND request_key=?",
        [users[0], payload.requestKey],
      )
    )[0].n,
    1,
  );
  assert.equal(
    (await send("/api/v1/posts", { ...payload, body: "changed" })).statusCode,
    409,
  );
  assert.equal((await app.inject("/api/v1/media/" + imageRef)).statusCode, 200);
  const found = (
    await app.inject("/api/v1/posts?q=" + encodeURIComponent(prefix))
  ).json().data.items;
  assert(found.some((p: { id: string }) => p.id === firstPost));
  const invalid = await send("/api/v1/posts", {
    ...makePost(),
    catIds: ["missing"],
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(
    (await send("/api/v1/posts", { ...makePost(), imageRefs: [imageRef] }, 1))
      .statusCode,
    400,
  );
  const wrong = await upload(image, "avatar");
  assert.equal(wrong.statusCode, 200);
  assetIds.push(wrong.json().data.imageRef);
  assert.equal(
    (
      await send("/api/v1/posts", {
        ...makePost(),
        imageRefs: [wrong.json().data.imageRef],
      })
    ).statusCode,
    400,
  );
});
test("publish boundaries: empty, 2000/2001 codepoints, image-only, 10 images and zero associations", async () => {
  assert.equal((await send("/api/v1/posts", makePost("  "))).statusCode, 400);
  assert.equal(
    (await send("/api/v1/posts", makePost("猫".repeat(2001)))).statusCode,
    400,
  );
  const good = await send("/api/v1/posts", makePost("🐈".repeat(2000)));
  assert.equal(good.statusCode, 200, good.body);
  posts.push(good.json().data.id);
  const only = await send("/api/v1/posts", {
    ...makePost(""),
    imageRefs: [imageRef],
  });
  assert.equal(only.statusCode, 200);
  posts.push(only.json().data.id);
  assert.deepEqual(only.json().data.cats, []);
  assert.deepEqual(only.json().data.topics, []);
  assert.equal(
    (
      await send("/api/v1/posts", {
        ...makePost(),
        imageRefs: Array.from({ length: 10 }, () => randomUUID()),
      })
    ).statusCode,
    400,
  );
});
test("comment and reply notify owner plus reply author, deduplicate and exclude actor; retries are stable", async () => {
  const input = comment("初次评论");
  const initial = await send(`/api/v1/posts/${firstPost}/comments`, input, 1);
  assert.equal(initial.statusCode, 200, initial.body);
  firstComment = initial.json().data.id;
  const notifications = await rows<{ recipient: string }>(
    "SELECT recipient_id AS recipient FROM notifications WHERE comment_id=?",
    [firstComment],
  );
  assert.deepEqual(
    notifications.map((n) => n.recipient),
    [users[0]],
  );
  const replyInput = comment("第三人回复", firstComment);
  const replies = await Promise.all(
    Array.from({ length: 4 }, () =>
      send(`/api/v1/posts/${firstPost}/comments`, replyInput, 2),
    ),
  );
  for (const r of replies) assert.equal(r.statusCode, 200, r.body);
  const replyId = replies[0].json().data.id;
  assert(replies.every((r) => r.json().data.id === replyId));
  const recipients = await rows<{ id: string }>(
    "SELECT recipient_id AS id FROM notifications WHERE comment_id=? ORDER BY recipient_id",
    [replyId],
  );
  assert.deepEqual(
    recipients.map((r) => r.id),
    [users[0], users[1]].sort(),
  );
  const self = await send(
    `/api/v1/posts/${firstPost}/comments`,
    comment("自评"),
    0,
  );
  assert.equal(
    (
      await rows("SELECT id FROM notifications WHERE comment_id=?", [
        self.json().data.id,
      ])
    ).length,
    0,
  );
  const ownerReply = await send(
    `/api/v1/posts/${firstPost}/comments`,
    comment("帖主回复", firstComment),
    0,
  );
  assert.equal(
    (
      await rows("SELECT id FROM notifications WHERE comment_id=?", [
        ownerReply.json().data.id,
      ])
    ).length,
    1,
  );
  assert.equal(
    (
      await send(
        `/api/v1/posts/${firstPost}/comments`,
        { ...replyInput, body: "changed" },
        2,
      )
    ).statusCode,
    409,
  );
});
test("reply cannot target another post, failed notification write rolls back comment and replay key", async () => {
  const other = await send("/api/v1/posts", makePost());
  const otherId = other.json().data.id;
  posts.push(otherId);
  assert.equal(
    (
      await send(
        `/api/v1/posts/${otherId}/comments`,
        comment("cross", firstComment),
        1,
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await send(
        `/api/v1/posts/${firstPost}/comments`,
        comment("missing", "missing"),
        1,
      )
    ).statusCode,
    400,
  );
  const key = comment("rollback");
  const original = db.getConnection.bind(db);
  db.getConnection = async () => {
    const c = await original();
    const execute = c.execute.bind(c);
    c.execute = ((...args: unknown[]) => {
      if (String(args[0]).startsWith("INSERT INTO notifications"))
        return Promise.reject(new Error("Injected notification failure"));
      return Reflect.apply(execute, c, args);
    }) as typeof c.execute;
    const release = c.release.bind(c);
    c.release = () => {
      c.execute = execute;
      c.release = release;
      release();
    };
    return c;
  };
  try {
    assert.equal(
      (await send(`/api/v1/posts/${firstPost}/comments`, key, 1)).statusCode,
      503,
    );
  } finally {
    db.getConnection = original;
  }
  assert.equal(
    (
      await rows(
        "SELECT id FROM comments WHERE author_id=? AND request_key=?",
        [users[1], key.requestKey],
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await rows(
        "SELECT request_key FROM idempotency_keys WHERE actor_id=? AND request_key=?",
        [users[1], key.requestKey],
      )
    ).length,
    0,
  );
  assert.equal(
    (await send(`/api/v1/posts/${firstPost}/comments`, key, 1)).statusCode,
    200,
  );
});
test("notification comment focus resolves the correct page and hidden content blocks all public routes/media", async () => {
  const list = await app.inject(
    `/api/v1/posts/${firstPost}/comments?pageSize=2&focusId=${firstComment}`,
  );
  assert.equal(list.statusCode, 200);
  assert(
    list.json().data.items.some((c: { id: string }) => c.id === firstComment),
  );
  assert.equal(
    (await app.inject(`/api/v1/posts/${firstPost}/comments?focusId=missing`))
      .statusCode,
    404,
  );
  // Hide all posts using the uploaded asset to check visibility without bypassing shared references.
  await db.execute("UPDATE posts SET status='hidden' WHERE author_id=?", [
    users[0],
  ]);
  assert.equal((await app.inject("/api/v1/media/" + imageRef)).statusCode, 404);
  assert.equal(
    (await app.inject({ url: "/api/v1/media/" + imageRef, headers: auth() }))
      .statusCode,
    404,
  );
  assert.equal(
    (await app.inject("/api/v1/posts/" + firstPost)).statusCode,
    404,
  );
  assert.equal(
    (await app.inject(`/api/v1/posts/${firstPost}/comments`)).statusCode,
    404,
  );
  assert.equal(
    (await send(`/api/v1/posts/${firstPost}/comments`, comment(), 1))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `/api/v1/posts/${firstPost}/like`,
        headers: auth(1),
        payload: { liked: true },
      })
    ).statusCode,
    404,
  );
  assert(
    !(await app.inject("/api/v1/posts?catId=demo-cat-1"))
      .json()
      .data.items.some((p: { id: string }) => p.id === firstPost),
  );
});
test("seven-day hot ranking has stable tie-breaks and top-ten limit, excludes old/hidden/deleted", async () => {
  const date = new Date(Date.now() - 60000);
  const ids = [];
  for (let i = 0; i < 15; i++) {
    const id = prefix + "-rank-" + String(i).padStart(2, "0");
    ids.push(id);
    posts.push(id);
    const status = i === 13 ? "hidden" : i === 14 ? "deleted" : "published";
    await db.execute(
      "INSERT INTO posts(id,author_id,body,status,request_key,created_at) VALUES(?,?,?,?,?,?)",
      [
        id,
        users[0],
        "Rank fixture",
        status,
        id,
        i === 12 ? new Date(Date.now() - 8 * 86400000) : date,
      ],
    );
    for (const user of users)
      await db.execute("INSERT INTO likes(user_id,post_id) VALUES(?,?)", [
        user,
        id,
      ]);
  }
  const result = (await app.inject("/api/v1/posts/hot")).json().data;
  assert.equal(result.items.length, 10);
  assert.deepEqual(
    result.items.map((p: { id: string }) => p.id),
    ids.slice(0, 12).sort().reverse().slice(0, 10),
  );
  assert(result.asOf.endsWith("Z"));
});
test("WeChat adapter maps a verified identity, never trusts client role, and masks upstream failures", async () => {
  const original = wechat.exchange;
  const platformId = "test-platform:" + prefix;
  try {
    wechat.exchange = async () => platformId;
    const a = await send("/api/v1/auth/wechat", { code: "test-platform-code" });
    assert.equal(a.statusCode, 200);
    const id = a.json().data.user.id;
    createdUsers.push(id);
    assert.equal(a.json().data.mode, "wechat");
    assert.equal(a.json().data.user.role, "user");
    assert(!a.body.includes(platformId));
    const b = await send("/api/v1/auth/wechat", { code: "another-code" });
    assert.equal(b.json().data.user.id, id);
    assert.equal(
      (await send("/api/v1/auth/wechat", { code: "x", role: "admin" }))
        .statusCode,
      400,
    );
    wechat.exchange = async () => {
      throw new Error("secret must never be returned");
    };
    const failed = await send("/api/v1/auth/wechat", { code: "x" });
    assert.equal(failed.statusCode, 503);
    assert(!failed.body.includes("secret"));
  } finally {
    wechat.exchange = original;
  }
});

test("hot window includes both exact endpoints and excludes records one millisecond outside", async () => {
  const asOf = new Date("2030-01-08T12:00:00.000Z");
  const offsets = [-7 * 86400000 - 1, -7 * 86400000, 0, 1];
  const ids = [];
  for (const [i, offset] of offsets.entries()) {
    const id = prefix + "-edge-" + i;
    ids.push(id);
    posts.push(id);
    await db.execute(
      "INSERT INTO posts(id,author_id,body,request_key,created_at) VALUES(?,?,?,?,?)",
      [id, users[0], "Boundary fixture", id, new Date(asOf.getTime() + offset)],
    );
  }
  const result = await findHotRows(asOf);
  assert.deepEqual(
    result.map((p) => p.id),
    [ids[2], ids[1]],
  );
});
