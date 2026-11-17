import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  storage = new Map();
let definition;
global.Page = (v) => (definition = v);
global.getCurrentPages = () => [{ route: "a" }, { route: "b" }];
global.wx = {
  getStorageSync: (k) => structuredClone(storage.get(k)),
  setStorageSync: (k, v) => storage.set(k, structuredClone(v)),
  removeStorageSync: (k) => storage.delete(k),
  showModal: (o) => o.success({ confirm: true }),
  nextTick: (f) => f(),
  pageScrollTo() {},
  navigateTo() {},
  navigateBack() {},
  switchTab() {},
};
const load = (n) => require("../dist/miniprogram/" + n + ".js");
function page(n) {
  const p = require.resolve("../dist/miniprogram/features/" + n + "/index.js");
  delete require.cache[p];
  require(p);
  return {
    ...definition,
    data: structuredClone(definition.data),
    setData(v) {
      Object.assign(this.data, structuredClone(v));
    },
  };
}
function session(id, token = id) {
  storage.set("maochumo.session.v1", {
    token,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: { id, role: "admin" },
  });
}
const { request, RequestError } = load("core/request"),
  { uploadImage } = load("core/upload");
for (const upload of [false, true])
  for (const changed of [false, true]) {
    session("A", "old");
    let respond;
    wx[upload ? "uploadFile" : "request"] = (o) => (respond = o.success);
    const p = (upload ? uploadImage("local.png") : request("/api/v1/me")).catch(
      (e) => e,
    );
    if (changed) session("B", "new");
    const error = {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "expired" },
    };
    respond({ statusCode: 401, data: upload ? JSON.stringify(error) : error });
    await p;
    assert.equal(
      storage.get("maochumo.session.v1")?.token,
      changed ? "new" : undefined,
    );
  }
console.log(
  "PASS R3: request/upload stale 401 preserves new token; current 401 clears expired session",
);
const api = load("core/api").api,
  detail = page("community/detail");
detail.load = async () => {};
detail.onLoad({ postId: "p" });
session("A");
detail.onShow();
detail.setData({
  body: "A draft",
  pending: { body: "A draft", replyToId: null, requestKey: "A-key" },
  likeTarget: true,
});
detail.persist();
session("B");
detail.onShow();
assert.equal(detail.data.body, "");
assert.equal(detail.data.pending, null);
assert.equal(detail.data.likeTarget, null);
detail.persist();
assert.equal(storage.get("maochumo.comment.B.p").body, "");
session("A");
detail.onShow();
assert.equal(detail.data.pending.requestKey, "A-key");
storage.delete("maochumo.session.v1");
detail.onShow();
detail.input({ detail: { value: "guest draft" } });
session("C");
detail.onShow();
assert.equal(detail.data.body, "guest draft");
assert(!storage.has("maochumo.comment.guest.p"));
let finish;
api.comment = () => new Promise((r) => (finish = r));
const sent = detail.send();
session("D");
detail.onShow();
detail.input({ detail: { value: "D draft" } });
finish({ id: "C-comment" });
await sent;
assert.equal(detail.data.body, "D draft");
assert(storage.get("maochumo.comment.C.p").pending);
const oldPage = page("community/detail");
oldPage.onLoad({ postId: "p2" });
let oldPost;
api.post = () => new Promise((r) => (oldPost = r));
session("A");
const loading = oldPage.load();
session("B");
oldPost({ id: "p2", author: { id: "A" }, liked: true });
await loading;
assert.equal(oldPage.data.post, null);
let liked;
api.like = () => new Promise((r) => (liked = r));
detail.setData({ post: { id: "p", liked: false, author: { id: "B" } } });
const oldLike = detail.like();
session("E");
detail.onShow();
liked({ liked: true, likeCount: 9 });
await oldLike;
assert.equal(detail.data.likeTarget, null);
assert.notEqual(detail.data.post?.likeCount, 9);
console.log(
  "PASS R1: identity drafts, guest migration, stale send/load/like response isolation",
);
const adminApi = load("features/admin/api").adminApi,
  { pendingAdmin } = load("features/admin/submission");
for (const kind of ["areas", "topics", "cats", "posts"]) {
  session("admin-" + kind);
  const calls = [];
  let lose = true;
  const method = {
    areas: "createArea",
    topics: "createTopic",
    cats: "createCat",
    posts: "hidePost",
  }[kind];
  adminApi[method] = async (...args) => {
    const input = args.at(-1);
    calls.push(structuredClone(args));
    if (lose) {
      lose = false;
      throw new RequestError("unknown", "NETWORK_ERROR");
    }
    return { id: "saved", version: 1, ...input };
  };
  let view = page("admin/" + kind);
  view.load = async () => {};
  if (kind === "posts") {
    view.select({ currentTarget: { dataset: { id: "post-target" } } });
    view.reasonInput({ detail: { value: "reason" } });
  } else {
    view.newDraft();
    view.setData({
      form: {
        ...view.data.form,
        name: "original",
        ...(kind === "cats" ? { areaId: "area" } : {}),
      },
    });
  }
  await view[kind === "posts" ? "confirm" : "submit"]();
  assert.equal(view.data.pending, true);
  if (kind === "posts") {
    view.reasonInput({ detail: { value: "changed" } });
    view.cancel();
    assert.equal(view.data.reason, "reason");
  } else {
    view.fieldInput({
      currentTarget: { dataset: { field: "name" } },
      detail: { value: "changed" },
    });
    view.newDraft();
    assert.equal(view.data.form.name, "original");
  }
  session("other");
  assert.equal(pendingAdmin(kind), null);
  session("admin-" + kind);
  view = page("admin/" + kind);
  view.load = async () => {};
  view.onShow();
  assert.equal(view.data.pending, true);
  await view[kind === "posts" ? "confirm" : "submit"]();
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(view.data.pending, false);
  assert.equal(pendingAdmin(kind), null);
}
session("known-error");
const view = page("admin/areas");
view.newDraft();
view.setData({ form: { ...view.data.form, name: "bad" } });
let previous;
adminApi.createArea = async (input) => {
  previous = input.requestKey;
  throw new RequestError("invalid", "VALIDATION_ERROR");
};
await view.submit();
assert.equal(view.data.pending, false);
assert.notEqual(view.requestKeyValue, previous);
view.fieldInput({
  currentTarget: { dataset: { field: "name" } },
  detail: { value: "fixed" },
});
assert.equal(view.data.form.name, "fixed");
console.log(
  "PASS R2: four admin modules freeze/restore original payload and key by account; definite failures release editing",
);
