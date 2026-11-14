import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import sharp from "sharp";
import "dotenv/config";
import mysql from "mysql2/promise";
const require = createRequire(import.meta.url);
const prefix = "ui-" + randomUUID();
const actor = prefix;
const token = randomBytes(32).toString("hex");
const db = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "maochumo",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "maochumo_demo",
});
const storage = new Map();
const navigations = [];
let definition;
let losePath = "";
let failUpload = false;
let postsSubmitted = 0;
const posts = [];
global.Page = (value) => (definition = value);
global.getCurrentPages = () => [
  { route: "features/community/detail/index" },
  { route: "features/account/login/index" },
];
global.wx = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  removeStorageSync: (key) => storage.delete(key),
  nextTick: (fn) => fn(),
  pageScrollTo() {},
  navigateTo: (r) => navigations.push(r.url),
  switchTab: (r) => navigations.push(r.url),
  navigateBack: () => navigations.push("back"),
  showModal: (r) => r.success({ confirm: true }),
  request(options) {
    if (options.url.endsWith("/posts") && options.method === "POST")
      postsSubmitted++;
    fetch(options.url, {
      method: options.method,
      headers: options.header,
      ...(options.data ? { body: JSON.stringify(options.data) } : {}),
    })
      .then(async (response) => {
        const data = await response.json();
        if (losePath && options.url.endsWith(losePath) && response.ok) {
          losePath = "";
          options.fail();
          return;
        }
        options.success({ statusCode: response.status, data });
      })
      .catch(() => options.fail());
  },
  uploadFile(options) {
    if (failUpload) {
      options.fail();
      return;
    }
    readFile(options.filePath)
      .then(async (bytes) => {
        const form = new FormData();
        form.append(
          "file",
          new Blob([bytes], { type: "image/png" }),
          "sample.png",
        );
        const response = await fetch(options.url, {
          method: "POST",
          headers: options.header,
          body: form,
        });
        options.success({
          statusCode: response.status,
          data: await response.text(),
        });
      })
      .catch(() => options.fail());
  },
};
function page(path) {
  delete require.cache[
    require.resolve("../dist/miniprogram/" + path + "/index.js")
  ];
  require("../dist/miniprogram/" + path + "/index.js");
  return {
    ...definition,
    data: structuredClone(definition.data),
    setData(v) {
      Object.assign(this.data, v);
    },
  };
}
try {
  await db.execute("INSERT INTO users(id,nickname) VALUES(?,?)", [
    actor,
    "UI integration",
  ]);
  await db.execute(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
    [createHash("sha256").update(token).digest("hex"), actor],
  );
  storage.set("maochumo.session.v1", {
    token,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: {
      id: actor,
      nickname: "UI integration",
      avatarRef: null,
      role: "user",
    },
    mode: "development",
  });
  const directory = ".local/tests/" + prefix;
  await mkdir(directory, { recursive: true });
  const path = directory + "/image.png";
  await writeFile(
    path,
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#c49052" },
    })
      .png()
      .toBuffer(),
  );
  const publish = page("features/community/publish");
  publish.draftKey = "maochumo.publish." + actor;
  publish.setData({
    body: "UI real HTTP " + prefix,
    images: [{ path }],
    catIds: ["demo-cat-1", "demo-cat-2"],
    topicIds: ["demo-topic"],
  });
  await publish.loadOptions();
  assert(publish.data.cats.length >= 2);
  failUpload = true;
  await publish.submit();
  assert.equal(postsSubmitted, 0);
  assert(publish.data.body.includes(prefix));
  assert.equal(publish.data.images.length, 1);
  assert.equal(publish.data.busy, false);
  failUpload = false;
  losePath = "/api/v1/posts";
  await publish.submit();
  assert(publish.data.pending);
  const key = publish.data.pending.requestKey;
  assert(publish.data.body.includes(prefix));
  await publish.submit();
  assert.equal(publish.data.pending, null);
  assert.equal(publish.data.body, "");
  const [written] = await db.execute(
    "SELECT id FROM posts WHERE author_id=? AND request_key=?",
    [actor, key],
  );
  assert.equal(written.length, 1);
  const postId = written[0].id;
  posts.push(postId);
  assert(navigations.some((n) => n.includes(postId)));
  console.log(
    "PASS publish Page: real upload failure preserves input; lost acknowledgement retries same request and creates one post",
  );
  const detail = page("features/community/detail");
  detail.onLoad({ postId });
  detail.draftKey = "maochumo.comment." + actor + "." + postId;
  await detail.load();
  assert.equal(detail.data.post.cats.length, 2);
  assert.equal(detail.data.canDelete, true);
  losePath = "/like";
  await detail.like();
  assert.equal(detail.data.likeTarget, true);
  await detail.like();
  assert.equal(detail.data.post.likeCount, 1);
  assert.equal(detail.data.post.liked, true);
  detail.setData({ body: "A comment through the compiled page" });
  losePath = "/comments";
  await detail.send();
  assert(detail.data.pending);
  const commentKey = detail.data.pending.requestKey;
  await detail.send();
  assert.equal(detail.data.pending, null);
  assert.equal(detail.data.body, "");
  const [comments] = await db.execute(
    "SELECT id FROM comments WHERE author_id=? AND request_key=?",
    [actor, commentKey],
  );
  assert.equal(comments.length, 1);
  assert(detail.data.comments.some((c) => c.id === comments[0].id));
  await detail.remove();
  assert(navigations.includes("/features/community/home/index"));
  const gone = await fetch("http://127.0.0.1:3000/api/v1/posts/" + postId);
  assert.equal(gone.status, 404);
  console.log(
    "PASS detail Page: target-state like retry, comment retry/focus and confirmed owner delete",
  );
  const { api } = require("../dist/miniprogram/core/api.js");
  const original = api.cats;
  const deferred = [];
  api.cats = () => new Promise((resolve) => deferred.push(resolve));
  const map = page("features/campus-map/index");
  map.setData({
    areas: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
  });
  const first = map.select("a");
  const second = map.select("b");
  deferred[1]({
    items: [{ id: "cat-b" }],
    page: 1,
    pageSize: 20,
    hasMore: false,
  });
  await second;
  deferred[0]({
    items: [{ id: "cat-a" }],
    page: 1,
    pageSize: 20,
    hasMore: false,
  });
  await first;
  assert.equal(map.data.cats[0].id, "cat-b");
  assert.equal(map.data.areaId, "b");
  api.cats = original;
  require("../dist/miniprogram/core/routes.js").resume("post");
  assert.equal(navigations.at(-1), "back");
  console.log(
    "PASS stale map request cannot replace the selected region; login returns to original detail stack",
  );

  const login = page("features/account/login");
  await login.checkCapabilities();
  const liveCapabilities = await (
    await fetch("http://127.0.0.1:3000/api/v1/capabilities")
  ).json();
  assert.equal(login.data.devAvailable, liveCapabilities.data.developmentLogin);
  assert.equal(login.data.wechatAvailable, liveCapabilities.data.wechatLogin);
  await login.login({ currentTarget: { dataset: { mode: "dev" } } });
  assert(login.data.message.includes("DEV_LOGIN_KEY"));
  console.log(
    "PASS login checks backend capabilities and validates missing local key without sending a failed login",
  );
  const originalAreas = api.areas;
  let finishOld;
  api.cats = () =>
    new Promise((resolve) => {
      finishOld = resolve;
    });
  const late = map.select("a");
  api.areas = async () => ({ items: [] });
  await map.load();
  finishOld({
    items: [{ id: "obsolete-cat" }],
    page: 1,
    pageSize: 20,
    hasMore: false,
  });
  await late;
  assert.deepEqual(map.data.cats, []);
  assert.equal(map.data.areaId, "");
  api.cats = original;
  api.areas = originalAreas;
  console.log("PASS map refresh invalidates an old region-list request");
} finally {
  const [owned] = await db.execute("SELECT id FROM posts WHERE author_id=?", [
    actor,
  ]);
  for (const { id } of owned) {
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
  const [assets] = await db.execute(
    "SELECT storage_key FROM assets WHERE owner_id=?",
    [actor],
  );
  for (const a of assets)
    await rm(
      (process.env.UPLOAD_DIR || ".local/uploads") + "/" + a.storage_key,
      { force: true },
    );
  for (const table of ["idempotency_keys", "sessions", "assets"])
    await db.execute(
      `DELETE FROM ${table} WHERE ${table === "idempotency_keys" ? "actor_id" : table === "sessions" ? "user_id" : "owner_id"}=?`,
      [actor],
    );
  await db.execute("DELETE FROM users WHERE id=?", [actor]);
  await db.end();
  await rm(".local/tests/" + prefix, { recursive: true, force: true });
}
