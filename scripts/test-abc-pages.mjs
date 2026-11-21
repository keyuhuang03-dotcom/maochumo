import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import mysql from "mysql2/promise";
import "dotenv/config";
const require = createRequire(import.meta.url),
  prefix = "abc-" + randomUUID();
const db = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "maochumo",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "maochumo_demo",
});
const users = [prefix + "a", prefix + "b"],
  tokens = users.map(() => randomUUID()),
  storage = new Map(),
  nav = [];
let definition;
let losePath = "";
global.Page = (v) => (definition = v);
global.getCurrentPages = () => [{ route: "a" }, { route: "b" }];
global.wx = {
  getStorageSync: (k) => storage.get(k),
  setStorageSync: (k, v) => storage.set(k, structuredClone(v)),
  removeStorageSync: (k) => storage.delete(k),
  navigateTo: (r) => nav.push(r.url),
  switchTab: (r) => nav.push(r.url),
  navigateBack: () => nav.push("back"),
  showToast() {},
  showModal: (r) => r.success({ confirm: true }),
  request(o) {
    fetch(o.url, {
      method: o.method,
      headers: o.header,
      ...(o.data ? { body: JSON.stringify(o.data) } : {}),
    })
      .then(async (r) => {
        const data = await r.json();
        if (losePath && o.url.endsWith(losePath) && r.ok) {
          losePath = "";
          o.fail();
          return;
        }
        o.success({ statusCode: r.status, data });
      })
      .catch(() => o.fail());
  },
};
function page(path) {
  const file = require.resolve(
    "../dist/miniprogram/features/" + path + "/index.js",
  );
  delete require.cache[file];
  if (path === "account/posts" || path === "account/likes")
    delete require.cache[
      require.resolve("../dist/miniprogram/features/account/content-page.js")
    ];
  require(file);
  return {
    ...definition,
    data: structuredClone(definition.data),
    setData(v) {
      Object.assign(this.data, v);
    },
  };
}
function login(i) {
  storage.set("maochumo.session.v1", {
    token: tokens[i],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: {
      id: users[i],
      nickname: "ABC",
      avatarRef: null,
      role: i === 1 ? "admin" : "user",
    },
    mode: "development",
  });
}
const req = async (path, method = "GET", body, i = 0) => {
  const r = await fetch("http://127.0.0.1:3000/api/v1" + path, {
    method,
    headers: {
      authorization: "Bearer " + tokens[i],
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await r.json();
  assert(r.ok, JSON.stringify(value));
  return value.data;
};
let catId = "",
  areaId = "",
  topicId = "",
  postId = "";
try {
  for (let i = 0; i < 2; i++) {
    await db.execute("INSERT INTO users(id,nickname,role) VALUES(?,?,?)", [
      users[i],
      "ABC",
      i === 1 ? "admin" : "user",
    ]);
    await db.execute(
      "INSERT INTO sessions VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
      [createHash("sha256").update(tokens[i]).digest("hex"), users[i]],
    );
  }
  login(1);
  const areas = page("admin/areas");
  areas.newDraft();
  areas.setData({
    form: { name: prefix, x: "0", y: "0", width: "0.1", height: "0.1" },
  });
  losePath = "/admin/areas";
  await areas.submit();
  assert.equal(areas.data.editingId, "");
  await areas.submit();
  const [areaCount] = await db.execute(
    "SELECT COUNT(*) AS n FROM areas WHERE name=?",
    [prefix],
  );
  assert.equal(areaCount[0].n, 1);
  areaId = areas.data.editingId;
  assert(areaId, areas.data.message);
  areas.fieldInput({
    currentTarget: { dataset: { field: "name" } },
    detail: { value: prefix + " updated" },
  });
  losePath = "/admin/areas/" + areaId;
  await areas.submit();
  assert.equal(areas.data.pending, true);
  areas.fieldInput({
    currentTarget: { dataset: { field: "name" } },
    detail: { value: "must not replace pending" },
  });
  assert.equal(areas.data.form.name, prefix + " updated");
  await areas.submit();
  assert.equal(areas.data.editingVersion, 2);
  const [versionRows] = await db.execute(
    "SELECT version FROM areas WHERE id=?",
    [areaId],
  );
  assert.equal(versionRows[0].version, 2);
  const cats = page("admin/cats");
  cats.newDraft();
  await cats.load();
  cats.setData({
    form: {
      name: prefix,
      areaId,
      aliases: "别名测试",
      sex: "unknown",
      appearance: "黑白",
      personality: "演示",
    },
  });
  losePath = "/admin/cats";
  await cats.submit();
  assert.equal(cats.data.pending, true);
  await cats.submit();
  catId = cats.data.editingId;
  assert(catId, cats.data.message);
  const topics = page("admin/topics");
  topics.newDraft();
  topics.setData({ form: { name: prefix, status: "active" } });
  losePath = "/admin/topics";
  await topics.submit();
  assert.equal(topics.data.pending, true);
  await topics.submit();
  topicId = topics.data.editingId;
  assert(topicId, topics.data.message);
  topics.setData({ form: { name: prefix, status: "inactive" } });
  await topics.submit();
  assert(
    topics.data.topics.some((t) => t.id === topicId && t.status === "inactive"),
  );
  topics.edit({ currentTarget: { dataset: { id: topicId } } });
  assert.equal(topics.data.form.status, "inactive");
  topics.setData({ form: { name: prefix, status: "active" } });
  await topics.submit();
  assert.equal(topics.data.form.status, "active");
  console.log(
    "PASS C pages -> request -> HTTP -> MySQL: area, cat, topic create/update/deactivate/reactivate",
  );
  login(0);
  const post = await req("/posts", "POST", {
    body: "ABC跨模块测试",
    imageRefs: [],
    catIds: [catId],
    topicIds: [topicId],
    requestKey: randomUUID(),
  });
  postId = post.id;
  const list = page("catalog/list");
  list.setData({ q: "别名测试", areaId });
  await list.fetchCatList(true);
  assert.equal(list.data.catList[0].id, catId);
  list.onTapCatCard({ detail: { catId } });
  assert(nav.at(-1).includes("catId=" + catId));
  const detail = page("catalog/detail");
  detail.onLoad({ catId });
  await detail.fetchDetail();
  assert.equal(detail.data.cat.id, catId);
  assert.equal(detail.data.aliasText, "别名测试");
  assert.equal(detail.data.posts[0].id, postId);
  detail.onTapPost({ detail: { postId } });
  assert(nav.at(-1).includes("postId=" + postId));
  list.setData({ q: "no-match-" + prefix });
  await list.fetchCatList(true);
  assert.equal(list.data.viewState, "empty");
  const api = require("../dist/miniprogram/core/api.js").api,
    original = api.cats;
  let finishOld;
  api.cats = () => new Promise((r) => (finishOld = r));
  const old = list.fetchCatList(true);
  api.cats = async () => ({ items: [], page: 1, pageSize: 20, hasMore: false });
  await list.fetchCatList(true);
  finishOld({
    items: [{ id: "obsolete" }],
    page: 1,
    pageSize: 20,
    hasMore: false,
  });
  await old;
  assert.equal(list.data.catList.length, 0);
  api.cats = original;
  console.log(
    "PASS A list/detail, aliases + area filter, empty result, stale response protection and post route",
  );
  await req("/posts/" + postId + "/like", "PUT", { liked: true });
  const mine = page("account/posts");
  await mine.fetchList(true);
  assert.equal(mine.data.list[0].id, postId);
  const likes = page("account/likes");
  await likes.fetchList(true);
  assert.equal(likes.data.list[0].id, postId);
  const settings = page("account/settings");
  await settings.onLoad();
  settings.setData({ nickname: "ABC更新昵称" });
  await settings.save();
  assert.equal(settings.data.message, "资料已保存");
  assert.equal(storage.get("maochumo.session.v1").user.nickname, "ABC更新昵称");
  const comment = await req(
    "/posts/" + postId + "/comments",
    "POST",
    { body: "新评论", replyToId: null, requestKey: randomUUID() },
    1,
  );
  const messages = page("account/messages");
  await messages.fetchList(true);
  assert.equal(messages.data.unreadCount, 1);
  assert.equal(messages.data.list.length, 1);
  await messages.openPost({
    currentTarget: { dataset: { id: messages.data.list[0].id } },
  });
  assert(nav.at(-1).includes("commentId="));
  await messages.markRead({
    currentTarget: { dataset: { id: messages.data.list[0].id } },
  });
  assert.equal(messages.data.unreadCount, 0);
  assert(messages.data.list[0].readAt);
  await messages.markAllRead();
  console.log(
    "PASS B profile/session, own posts/likes, actual comment notification, focus route and idempotent read refresh",
  );
  login(1);
  const reply = await req(
    "/posts/" + postId + "/comments",
    "POST",
    { body: "管理员回复", replyToId: comment.id, requestKey: randomUUID() },
    1,
  );
  login(0);
  await messages.fetchList(true);
  assert.equal(messages.data.unreadCount, 1);
  const notice = messages.data.list.find((item) => item.commentId === reply.id);
  assert.equal(notice?.type, "reply");
  await messages.openPost({ currentTarget: { dataset: { id: notice.id } } });
  assert(nav.at(-1).includes("commentId=" + reply.id));
  await messages.fetchList(true);
  assert.equal(messages.data.unreadCount, 0);
  login(1);
  const moderation = page("admin/posts");
  moderation.requestKeyValue = randomUUID();
  moderation.setData({ selectedId: postId, reason: "自动化联调" });
  losePath = "/admin/posts/" + postId + "/hide";
  await moderation.confirm();
  assert.equal(moderation.data.pending, true);
  moderation.reasonInput({ detail: { value: "must not replace pending" } });
  assert.equal(moderation.data.reason, "自动化联调");
  await moderation.confirm();
  assert.equal(moderation.data.selectedId, "", moderation.data.message);
  login(0);
  await likes.fetchList(true);
  assert.equal(likes.data.list.length, 0);
  await messages.fetchList(true);
  assert.equal(messages.data.list[0].targetAvailable, false);
  nav.length = 0;
  await messages.openPost({
    currentTarget: { dataset: { id: messages.data.list[0].id } },
  });
  assert.equal(nav.length, 0);
  const feed = await req("/posts");
  assert(!feed.items.some((item) => item.id === postId));
  const search = await req("/posts?q=" + encodeURIComponent(post.body));
  assert(!search.items.some((item) => item.id === postId));
  await detail.loadPosts(true);
  assert.equal(detail.data.posts.length, 0);
  console.log(
    "PASS C hide immediately excludes A associated posts and B likes; unavailable notifications cannot navigate",
  );
  await settings.logout();
  assert(!storage.has("maochumo.session.v1"));
  assert(nav.at(-1).includes("/account/"));
  console.log("PASS B logout revokes session and returns to account tab");
} finally {
  // Remove only isolated test records; never reset the demo seed.
  for (const user of users) {
    await db.execute("DELETE FROM admin_logs WHERE actor_id=?", [user]);
    await db.execute("DELETE FROM idempotency_keys WHERE actor_id=?", [user]);
  }
  const [owned] = await db.execute(
    "SELECT id FROM posts WHERE author_id IN (?,?)",
    users,
  );
  for (const p of owned) {
    await db.execute("DELETE FROM notifications WHERE post_id=?", [p.id]);
    await db.execute("UPDATE comments SET reply_to_id=NULL WHERE post_id=?", [
      p.id,
    ]);
    for (const table of [
      "comments",
      "likes",
      "post_images",
      "post_cats",
      "post_topics",
    ])
      await db.execute(`DELETE FROM ${table} WHERE post_id=?`, [p.id]);
    await db.execute("DELETE FROM posts WHERE id=?", [p.id]);
  }
  if (catId) await db.execute("DELETE FROM cats WHERE id=?", [catId]);
  if (areaId) await db.execute("DELETE FROM areas WHERE id=?", [areaId]);
  if (topicId) await db.execute("DELETE FROM topics WHERE id=?", [topicId]);
  for (const user of users) {
    await db.execute("DELETE FROM sessions WHERE user_id=?", [user]);
    await db.execute("DELETE FROM users WHERE id=?", [user]);
  }
  await db.end();
}
