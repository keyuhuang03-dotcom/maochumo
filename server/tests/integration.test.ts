import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "../src/config";
import { buildApp } from "../src/app";
import { db, rows, transaction } from "../src/common/db";
import { assertReplyTarget } from "../src/modules/interactions/guards";
import { tokenHash } from "../src/common/auth";
const app = buildApp();
test("database sessions use UTC for created_at defaults", async () => {
  const [row] = await rows<{ zone: string }>(
    "SELECT @@session.time_zone AS zone",
  );
  assert.equal(row.zone, "+00:00");
});
const member = randomBytes(32).toString("hex");
const admin = randomBytes(32).toString("hex");
const id = "test-" + randomUUID();
const auth = (token: string) => ({ authorization: "Bearer " + token });
before(async () => {
  for (const [token, user] of [
    [member, "demo-member"],
    [admin, "demo-admin"],
  ])
    await db.execute(
      "INSERT INTO sessions VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
      [tokenHash(token), user],
    );
  await db.execute(
    "INSERT INTO posts(id,author_id,body,request_key) VALUES(?,?,?,?)",
    [id, "demo-member", "Temporary integration record", id],
  );
});
after(async () => {
  await db.execute("DELETE FROM likes WHERE post_id=?", [id]);
  await db.execute("DELETE FROM posts WHERE id=?", [id]);
  for (const token of [member, admin])
    await db.execute("DELETE FROM sessions WHERE token_hash=?", [
      tokenHash(token),
    ]);
  await app.close();
  await db.end();
});
test("real database: public success, empty, invalid, hidden and deleted", async () => {
  const success = await app.inject("/api/v1/posts");
  assert.equal(success.statusCode, 200);
  const body = success.json();
  assert.equal(body.ok, true);
  assert(
    body.data.items.some((p: { id: string }) => p.id === "demo-post-public"),
  );
  assert(!JSON.stringify(body).includes("demo-post-hidden"));
  assert(!JSON.stringify(body).includes("demo-post-deleted"));
  const empty = (
    await app.inject("/api/v1/posts?q=__no_matching_demo_7ba9__")
  ).json();
  assert.deepEqual(empty.data.items, []);
  for (const postId of ["demo-post-hidden", "demo-post-deleted", "missing"])
    assert.equal((await app.inject("/api/v1/posts/" + postId)).statusCode, 404);
  assert.equal((await app.inject("/api/v1/posts?page=0")).statusCode, 400);
  assert.equal(
    (await app.inject("/api/v1/posts?unexpected=1")).statusCode,
    400,
  );
});
test("stable cat IDs, empty area and foreign-key requirements", async () => {
  const cats = (await app.inject("/api/v1/cats?q=橘子")).json().data.items;
  assert.equal(cats.length, 2);
  assert.notEqual(cats[0].id, cats[1].id);
  assert.deepEqual(
    (await app.inject("/api/v1/cats?areaId=demo-area-empty")).json().data.items,
    [],
  );
  await assert.rejects(
    db.execute(
      "INSERT INTO cats(id,name,area_id,aliases,photo_refs) VALUES('invalid-test-cat','x','missing','[]','[]')",
    ),
  );
});
test("authentication, roles and reserved endpoints remain honest", async () => {
  assert.equal((await app.inject("/api/v1/me")).statusCode, 401);
  assert.equal(
    (await app.inject({ url: "/api/v1/me", headers: auth("invalid") }))
      .statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: "/api/v1/me", headers: auth(member) })).json().data
      .id,
    "demo-member",
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/cats",
        headers: auth(member),
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/cats",
        headers: auth(admin),
      })
    ).statusCode,
    501,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/me/notifications",
        headers: auth(member),
      })
    ).statusCode,
    501,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/uploads",
        headers: auth(member),
      })
    ).statusCode,
    503,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/wechat",
        payload: { code: "example" },
      })
    ).statusCode,
    503,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/dev",
        payload: { profile: "member", key: "invalid" },
      })
    ).statusCode,
    404,
  );
});
test("concurrent target-state likes and owner-only idempotent delete", async () => {
  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      app.inject({
        method: "PUT",
        url: `/api/v1/posts/${id}/like`,
        headers: auth(member),
        payload: { liked: true },
      }),
    ),
  );
  assert(
    responses.every(
      (r) => r.statusCode === 200 && r.json().data.likeCount === 1,
    ),
  );
  assert.equal(
    (
      await app.inject({ url: "/api/v1/posts/" + id, headers: auth(member) })
    ).json().data.liked,
    true,
  );
  assert.equal(
    (
      await rows<{ n: number }>(
        "SELECT COUNT(*) AS n FROM likes WHERE post_id=?",
        [id],
      )
    )[0].n,
    1,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: `/api/v1/posts/${id}/like`,
          headers: auth(member),
          payload: { liked: false },
        })
      ).json().data.likeCount,
      0,
    );
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: "/api/v1/posts/" + id,
        headers: auth(admin),
      })
    ).statusCode,
    403,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/v1/posts/" + id,
          headers: auth(member),
        })
      ).statusCode,
      200,
    );
  assert.equal((await app.inject("/api/v1/posts/" + id)).statusCode, 404);
});
test("transaction rolls back and same-post reply checked by shared application guard", async () => {
  await assert.rejects(
    transaction(async (c) => {
      await c.execute("INSERT INTO topics(id,name) VALUES(?,?)", [id, id]);
      throw new Error("test rollback");
    }),
  );
  assert.equal(
    (await rows("SELECT id FROM topics WHERE id=?", [id])).length,
    0,
  );
  await transaction(async (c) => {
    await c.execute(
      "INSERT INTO comments(id,post_id,author_id,body,request_key) VALUES(?,?,?,?,?)",
      [id, "demo-post-public", "demo-member", "test", id],
    );
    await assertReplyTarget(c, "demo-post-public", id);
    await assert.rejects(assertReplyTarget(c, "demo-post-hidden", id));
    await assert.rejects(assertReplyTarget(c, "demo-post-public", "missing"));
    await c.execute("DELETE FROM comments WHERE id=?", [id]);
  });
});
test("production refuses development identity", () => {
  const result = spawnSync(
    process.execPath,
    ["-e", "require('./dist/server/server/src/config.js')"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        DEV_AUTH_ENABLED: "true",
        DEV_LOGIN_KEY: "x".repeat(32),
      },
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0);
});

test("explicit development login issues a real expiring session without allowing arbitrary roles", async () => {
  const previous = { enabled: config.devAuth, key: config.devKey };
  config.devAuth = true;
  config.devKey = randomBytes(32).toString("hex");
  try {
    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/auth/dev",
      payload: { profile: "member", key: "wrong" },
    });
    assert.equal(wrong.statusCode, 403);
    const extra = await app.inject({
      method: "POST",
      url: "/api/v1/auth/dev",
      payload: { profile: "member", key: config.devKey, role: "admin" },
    });
    assert.equal(extra.statusCode, 400);
    const result = await app.inject({
      method: "POST",
      url: "/api/v1/auth/dev",
      payload: { profile: "member", key: config.devKey },
    });
    assert.equal(result.statusCode, 200);
    const session = result.json().data;
    assert.equal(session.mode, "development");
    assert.equal(session.user.role, "user");
    assert.equal(
      (await app.inject({ url: "/api/v1/me", headers: auth(session.token) }))
        .statusCode,
      200,
    );
    await db.execute(
      "UPDATE sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE token_hash=?",
      [tokenHash(session.token)],
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/me", headers: auth(session.token) }))
        .statusCode,
      401,
    );
    await db.execute("DELETE FROM sessions WHERE token_hash=?", [
      tokenHash(session.token),
    ]);
  } finally {
    config.devAuth = previous.enabled;
    config.devKey = previous.key;
  }
});

test("database unavailable returns sanitized 503 instead of success", () => {
  const code =
    "const {buildApp}=require('./dist/server/server/src/app.js');const {db}=require('./dist/server/server/src/common/db.js');(async()=>{const app=buildApp();const r=await app.inject('/health');if(r.statusCode!==503||r.json().error.code!=='SERVICE_UNAVAILABLE')process.exitCode=1;await app.close();await db.end();})();";
  const result = spawnSync(process.execPath, ["-e", code], {
    env: { ...process.env, DB_PORT: "1", DEV_AUTH_ENABLED: "false" },
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(result.status, 0);
});
