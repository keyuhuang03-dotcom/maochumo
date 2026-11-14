import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
let definition;
global.Page = (value) => {
  definition = value;
};
// Only the platform transport/storage are adapted. The compiled Page, api and request modules run unchanged against real HTTP/MySQL.
let requests = 0;
global.wx = {
  getStorageSync() {
    return null;
  },
  removeStorageSync() {},
  request(options) {
    requests++;
    fetch(options.url, { method: options.method, headers: options.header })
      .then(async (response) =>
        options.success({
          statusCode: response.status,
          data: await response.json(),
        }),
      )
      .catch(() => options.fail());
  },
};
require("../dist/miniprogram/features/community/home/index.js");
const page = {
  ...definition,
  data: structuredClone(definition.data),
  setData(value) {
    Object.assign(this.data, value);
  },
};
await page.load();
assert.equal(page.data.state, "ready");
assert(page.data.posts.some((p) => p.id === "demo-post-public"));
assert.equal(requests, 2);
console.log(
  "PASS compiled home Page -> unified request -> HTTP -> MySQL -> setData (platform rendering NOT verified)",
);
const {
  request,
  RequestError,
} = require("../dist/miniprogram/core/request.js");
const empty = await request("/api/v1/posts?q=__no_matching_demo_7ba9__");
assert.deepEqual(empty.items, []);
await assert.rejects(
  request("/api/v1/posts/demo-post-hidden"),
  (e) => e instanceof RequestError && e.code === "NOT_FOUND",
);
console.log(
  "PASS real HTTP empty and failure response through mini request wrapper",
);

const { api } = require("../dist/miniprogram/core/api.js");
api.posts = () => request("/api/v1/posts?q=__no_matching_demo_7ba9__");
await page.load();
assert.equal(page.data.state, "empty");
assert.deepEqual(page.data.posts, []);
api.posts = () => request("/api/v1/posts?page=0");
await page.load();
assert.equal(page.data.state, "error");
assert(page.data.message.length > 0);
console.log(
  "PASS home Page empty/error state transitions using real HTTP responses",
);

require("../dist/miniprogram/features/campus-map/index/index.js");
const map = {
  ...definition,
  data: structuredClone(definition.data),
  setData(v) {
    Object.assign(this.data, v);
  },
};
await map.load();
assert.equal(map.data.areas.length, 3);
await map.select("demo-area-library");
assert.equal(map.data.cats[0].id, "demo-cat-1");
await map.select("demo-area-empty");
assert.equal(map.data.state, "empty");
console.log("PASS map Page -> real areas/cats API and empty-area state");
