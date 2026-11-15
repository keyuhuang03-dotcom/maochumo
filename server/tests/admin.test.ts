import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import sharp from "sharp";
import {
  CreateArea,
  CreateCat,
  CreateTopic,
  HidePost,
  UpdateCat,
  UpdateTopic,
} from "../../contracts";
import { config } from "../src/config";
import { buildApp } from "../src/app";
import { db, rows } from "../src/common/db";
import { tokenHash } from "../src/common/auth";

const app = buildApp();
const prefix = "admin-" + randomUUID();
const adminId = prefix + "-admin";
const memberId = prefix + "-member";
const otherAdminId = prefix + "-other";
const userIds = [adminId, memberId, otherAdminId];
const adminToken = randomBytes(32).toString("hex");
const memberToken = randomBytes(32).toString("hex");
const otherAdminToken = randomBytes(32).toString("hex");
const baseAreaId = prefix + "-base-area";
const createdAreaIds = new Set<string>([baseAreaId]);
const createdCatIds = new Set<string>();
const createdTopicIds = new Set<string>();
const createdPostIds = new Set<string>();
const originalUploadDriver = config.uploadDriver;
const originalUploadDir = config.uploadDir;
let imageBytes: Buffer;
let catPhotoRef = "";
let postPhotoRef = "";
let otherAdminCatPhotoRef = "";
let areaId = "";
let areaVersion = 0;
let firstCatId = "";
let firstCatVersion = 0;
let firstCatName = "";
let topicId = "";
let topicVersion = 0;
let secondTopicId = "";
let testPostId = "";
const auth = (token: string) => ({ authorization: "Bearer " + token });
const requestKey = () => "admin-" + randomUUID();
const areaInput = (
  key: string,
  overrides: Partial<CreateArea> = {},
): CreateArea => ({
  name: "测试区域",
  region: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
  requestKey: key,
  ...overrides,
});
const catInput = (
  key: string,
  overrides: Partial<CreateCat> = {},
): CreateCat => ({
  name: "测试猫",
  areaId: baseAreaId,
  aliases: ["小测试"],
  photoRefs: [],
  sex: "unknown",
  appearance: "橘白",
  personality: "亲人",
  requestKey: key,
  ...overrides,
});
const topicInput = (
  key: string,
  overrides: Partial<CreateTopic> = {},
): CreateTopic => ({
  name: "测试话题-" + key,
  status: "active",
  requestKey: key,
  ...overrides,
});
const create = (
  resource: "cats" | "areas",
  payload: CreateCat | CreateArea,
  token = adminToken,
) =>
  app.inject({
    method: "POST",
    url: "/api/v1/admin/" + resource,
    headers: auth(token),
    payload,
  });
const update = (
  resource: "cats" | "areas",
  id: string,
  payload: UpdateCat | (CreateArea & { version: number }),
) =>
  app.inject({
    method: "PUT",
    url: `/api/v1/admin/${resource}/${id}`,
    headers: auth(adminToken),
    payload,
  });
async function upload(purpose: "cat" | "post", token: string) {
  const boundary = "admin-test-boundary";
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/uploads?purpose=" + purpose,
    headers: {
      ...auth(token),
      "content-type": "multipart/form-data; boundary=" + boundary,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      imageBytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json().data.imageRef as string;
}

before(async () => {
  config.uploadDriver = "local";
  config.uploadDir = ".local/tests/" + prefix;
  for (const [id, role] of [
    [adminId, "admin"],
    [memberId, "user"],
    [otherAdminId, "admin"],
  ])
    await db.execute("INSERT INTO users(id,nickname,role) VALUES(?,?,?)", [
      id,
      id,
      role,
    ]);
  for (const [token, userId] of [
    [adminToken, adminId],
    [memberToken, memberId],
    [otherAdminToken, otherAdminId],
  ])
    await db.execute(
      "INSERT INTO sessions VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
      [tokenHash(token), userId],
    );
  await db.execute("INSERT INTO areas(id,name,region) VALUES(?,?,?)", [
    baseAreaId,
    "测试初始区域",
    JSON.stringify({ x: 0, y: 0, width: 0.5, height: 0.5 }),
  ]);
  imageBytes = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 20, g: 120, b: 180 },
    },
  })
    .png()
    .toBuffer();
  catPhotoRef = await upload("cat", adminToken);
  postPhotoRef = await upload("post", adminToken);
  otherAdminCatPhotoRef = await upload("cat", otherAdminToken);
});

after(async () => {
  await db.execute("DELETE FROM admin_logs WHERE actor_id IN (?,?,?)", userIds);
  await db.execute(
    "DELETE FROM idempotency_keys WHERE actor_id IN (?,?,?)",
    userIds,
  );
  for (const id of createdPostIds) {
    await db.execute("DELETE FROM post_cats WHERE post_id=?", [id]);
    await db.execute("DELETE FROM post_topics WHERE post_id=?", [id]);
    await db.execute("DELETE FROM posts WHERE id=?", [id]);
  }
  for (const id of createdTopicIds)
    await db.execute("DELETE FROM topics WHERE id=?", [id]);
  for (const id of createdCatIds)
    await db.execute("DELETE FROM cats WHERE id=?", [id]);
  for (const id of createdAreaIds)
    await db.execute("DELETE FROM areas WHERE id=?", [id]);
  await db.execute("DELETE FROM assets WHERE owner_id IN (?,?,?)", userIds);
  await db.execute("DELETE FROM sessions WHERE user_id IN (?,?,?)", userIds);
  await db.execute("DELETE FROM users WHERE id IN (?,?,?)", userIds);
  await rm(config.uploadDir, { recursive: true, force: true });
  config.uploadDriver = originalUploadDriver;
  config.uploadDir = originalUploadDir;
  await app.close();
  await db.end();
});

test("cat and area administration requires a valid admin session", async () => {
  const payload = areaInput(requestKey());
  assert.equal(
    (await app.inject({ method: "POST", url: "/api/v1/admin/areas", payload }))
      .statusCode,
    401,
  );
  assert.equal((await create("areas", payload, memberToken)).statusCode, 403);
  const topicPayload = topicInput(requestKey());
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/topics",
        payload: topicPayload,
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/topics",
        headers: auth(memberToken),
        payload: topicPayload,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/topics",
        headers: auth(memberToken),
        payload: { ...topicPayload, role: "admin" },
      })
    ).statusCode,
    403,
  );
  const hidePayload = { reason: "权限测试", requestKey: requestKey() };
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/v1/admin/posts/any-post/hide",
        payload: hidePayload,
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/v1/admin/posts/any-post/hide",
        headers: auth(memberToken),
        payload: hidePayload,
      })
    ).statusCode,
    403,
  );
});

test("area create validates data, replays the original result and writes one log", async () => {
  const input = areaInput(requestKey(), { name: "  南门测试区  " });
  const response = await create("areas", input);
  assert.equal(response.statusCode, 200, response.body);
  const area = response.json().data;
  areaId = area.id;
  areaVersion = area.version;
  createdAreaIds.add(area.id);
  assert.equal(area.name, "南门测试区");
  assert.equal(area.version, 1);
  assert.deepEqual(area.region, input.region);

  const replay = await create("areas", input);
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json().data, area);
  const conflict = await create("areas", { ...input, name: "不同区域" });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, "IDEMPOTENCY_CONFLICT");

  const logs = await rows<{ action: string }>(
    "SELECT action FROM admin_logs WHERE object_type='area' AND object_id=?",
    [area.id],
  );
  assert.deepEqual(logs, [{ action: "create" }]);
  const [idem] = await rows<{ count: number }>(
    "SELECT COUNT(*) AS count FROM idempotency_keys WHERE actor_id=? AND scope='admin:areas:create' AND request_key=?",
    [adminId, input.requestKey],
  );
  assert.equal(Number(idem.count), 1);

  const invalidRegion = await create(
    "areas",
    areaInput(requestKey(), {
      region: { x: 0.8, y: 0.1, width: 0.3, height: 0.3 },
    }),
  );
  assert.equal(invalidRegion.statusCode, 400);
  assert.equal(invalidRegion.json().error.code, "INVALID_REGION");
  const emptyName = await create(
    "areas",
    areaInput(requestKey(), { name: "   " }),
  );
  assert.equal(emptyName.statusCode, 400);
  assert.equal(emptyName.json().error.code, "INVALID_AREA");
});

test("area update preserves ID, increments version and rejects stale data", async () => {
  const input = {
    ...areaInput(requestKey(), {
      name: "南区",
      region: { x: 0.2, y: 0.2, width: 0.4, height: 0.4 },
    }),
    version: areaVersion,
  };
  const response = await update("areas", areaId, input);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().data.id, areaId);
  assert.equal(response.json().data.name, "南区");
  assert.equal(response.json().data.version, areaVersion + 1);
  areaVersion = response.json().data.version;

  const replay = await update("areas", areaId, input);
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json().data, response.json().data);
  const stale = await update("areas", areaId, {
    ...areaInput(requestKey(), { name: "过期修改" }),
    version: areaVersion - 1,
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, "VERSION_CONFLICT");
  const logs = await rows<{ action: string }>(
    "SELECT action FROM admin_logs WHERE object_type='area' AND object_id=? AND action='update'",
    [areaId],
  );
  assert.equal(logs.length, 1);
});

test("cat create supports duplicate names and validates areas and real image ownership", async () => {
  const input = catInput(requestKey(), {
    name: "重复名",
    photoRefs: [catPhotoRef],
  });
  const first = await create("cats", input);
  assert.equal(first.statusCode, 200, first.body);
  const firstCat = first.json().data;
  firstCatId = firstCat.id;
  firstCatVersion = firstCat.version;
  firstCatName = firstCat.name;
  createdCatIds.add(firstCat.id);
  assert.equal(firstCat.areaId, baseAreaId);
  assert.deepEqual(firstCat.photoRefs, [catPhotoRef]);
  assert.equal(firstCat.version, 1);

  const second = await create(
    "cats",
    catInput(requestKey(), { name: "重复名", photoRefs: [catPhotoRef] }),
  );
  assert.equal(second.statusCode, 200, second.body);
  createdCatIds.add(second.json().data.id);
  assert.notEqual(second.json().data.id, firstCat.id);
  assert.equal(second.json().data.name, firstCat.name);

  const replay = await create("cats", input);
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json().data, firstCat);
  const firstLogs = await rows(
    "SELECT id FROM admin_logs WHERE object_type='cat' AND object_id=?",
    [firstCat.id],
  );
  assert.equal(firstLogs.length, 1);

  for (const invalid of [
    catInput(requestKey(), { areaId: "missing-area" }),
    catInput(requestKey(), { photoRefs: [randomUUID()] }),
    catInput(requestKey(), { photoRefs: [postPhotoRef] }),
    catInput(requestKey(), { photoRefs: [otherAdminCatPhotoRef] }),
  ]) {
    const response = await create("cats", invalid);
    assert.equal(response.statusCode, 400, response.body);
    assert.match(response.json().error.code, /^INVALID_(AREA|IMAGE)$/);
  }
});

test("cat update uses ID and version, validates references and replays without another log", async () => {
  const input: UpdateCat = {
    ...catInput(requestKey(), {
      name: "更新后的猫",
      aliases: ["新别名"],
      photoRefs: [catPhotoRef],
      sex: "female",
      appearance: "三花",
      personality: null,
    }),
    version: firstCatVersion,
  };
  const response = await update("cats", firstCatId, input);
  assert.equal(response.statusCode, 200, response.body);
  const cat = response.json().data;
  assert.equal(cat.id, firstCatId);
  assert.equal(cat.version, firstCatVersion + 1);
  assert.equal(cat.name, "更新后的猫");
  assert.equal(cat.personality, null);
  firstCatVersion = cat.version;
  firstCatName = cat.name;

  const replay = await update("cats", firstCatId, input);
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json().data, cat);
  const stale = await update("cats", firstCatId, {
    ...catInput(requestKey(), { name: "过期修改" }),
    version: firstCatVersion - 1,
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, "VERSION_CONFLICT");

  const invalidArea = await update("cats", firstCatId, {
    ...catInput(requestKey(), { areaId: "missing-area" }),
    version: firstCatVersion,
  });
  assert.equal(invalidArea.statusCode, 400);
  const invalidImage = await update("cats", firstCatId, {
    ...catInput(requestKey(), { photoRefs: [otherAdminCatPhotoRef] }),
    version: firstCatVersion,
  });
  assert.equal(invalidImage.statusCode, 400);

  const [unchanged] = await rows<{ name: string; version: number }>(
    "SELECT name,version FROM cats WHERE name='重复名' AND id<>?",
    [firstCatId],
  );
  assert.equal(unchanged.name, "重复名");
  assert.equal(Number(unchanged.version), 1);
  const logs = await rows(
    "SELECT id FROM admin_logs WHERE object_type='cat' AND object_id=? AND action='update'",
    [firstCatId],
  );
  assert.equal(logs.length, 1);
});

test("cat update rolls back business data and idempotency when logging fails", async () => {
  const input: UpdateCat = {
    ...catInput(requestKey(), { name: "日志失败回滚" }),
    version: firstCatVersion,
  };
  const original = db.getConnection;
  const broken: any = async () => {
    const c = await original.call(db);
    const exec = c.execute.bind(c);
    c.execute = async (sql: any, values: any) => {
      if (typeof sql === "string" && sql.includes("INSERT INTO admin_logs"))
        throw new Error("injected admin_logs failure");
      return exec(sql, values);
    };
    return c;
  };
  db.getConnection = broken;
  let response;
  try {
    response = await update("cats", firstCatId, input);
  } finally {
    db.getConnection = original;
  }
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "SERVICE_UNAVAILABLE");
  const [row] = await rows<{ name: string; version: number }>(
    "SELECT name,version FROM cats WHERE id=?",
    [firstCatId],
  );
  assert.equal(row.name, firstCatName);
  assert.equal(Number(row.version), firstCatVersion);
  const [idem] = await rows<{ count: number }>(
    "SELECT COUNT(*) AS count FROM idempotency_keys WHERE actor_id=? AND scope='admin:cats:update' AND request_key=?",
    [adminId, input.requestKey],
  );
  assert.equal(Number(idem.count), 0);
  const logs = await rows(
    "SELECT id FROM admin_logs WHERE object_type='cat' AND object_id=? AND action='update'",
    [firstCatId],
  );
  assert.equal(logs.length, 1);

  const retry = await update("cats", firstCatId, input);
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(retry.json().data.version, firstCatVersion + 1);
  firstCatVersion = retry.json().data.version;
});

test("topic create enforces unique names, replays the stored result and logs once", async () => {
  const input = topicInput(requestKey());
  const request = () =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/topics",
      headers: auth(adminToken),
      payload: input,
    });
  const response = await request();
  assert.equal(response.statusCode, 200, response.body);
  const topic = response.json().data;
  topicId = topic.id;
  topicVersion = topic.version;
  createdTopicIds.add(topic.id);
  assert.equal(topic.name, input.name);
  assert.equal(topic.status, "active");
  assert.equal(topic.version, 1);

  const replay = await request();
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json().data, topic);
  const conflict = await app.inject({
    method: "POST",
    url: "/api/v1/admin/topics",
    headers: auth(adminToken),
    payload: { ...input, status: "inactive" },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, "IDEMPOTENCY_CONFLICT");
  const duplicate = await app.inject({
    method: "POST",
    url: "/api/v1/admin/topics",
    headers: auth(adminToken),
    payload: topicInput(requestKey(), { name: "  " + input.name + "  " }),
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, "TOPIC_EXISTS");
  const empty = await app.inject({
    method: "POST",
    url: "/api/v1/admin/topics",
    headers: auth(adminToken),
    payload: topicInput(requestKey(), { name: "   " }),
  });
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.json().error.code, "INVALID_TOPIC");

  const logs = await rows<{ action: string }>(
    "SELECT action FROM admin_logs WHERE object_type='topic' AND object_id=?",
    [topic.id],
  );
  assert.deepEqual(
    logs.map((l) => l.action),
    ["create"],
  );
});

test("topic update uses version, supports deactivation and rejects duplicate renames", async () => {
  const secondName = "第二话题-" + prefix;
  const second = await app.inject({
    method: "POST",
    url: "/api/v1/admin/topics",
    headers: auth(adminToken),
    payload: topicInput(requestKey(), { name: secondName }),
  });
  assert.equal(second.statusCode, 200, second.body);
  secondTopicId = second.json().data.id;
  createdTopicIds.add(secondTopicId);

  const input: UpdateTopic = {
    name: "停用话题-" + prefix,
    status: "inactive",
    version: topicVersion,
    requestKey: requestKey(),
  };
  const request = () =>
    app.inject({
      method: "PUT",
      url: "/api/v1/admin/topics/" + topicId,
      headers: auth(adminToken),
      payload: input,
    });
  const response = await request();
  assert.equal(response.statusCode, 200, response.body);
  const topic = response.json().data;
  assert.equal(topic.id, topicId);
  assert.equal(topic.name, input.name);
  assert.equal(topic.status, "inactive");
  assert.equal(topic.version, topicVersion + 1);
  topicVersion = topic.version;

  const replay = await request();
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json().data, topic);
  const stale = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/topics/" + topicId,
    headers: auth(adminToken),
    payload: {
      name: "过期话题",
      status: "active",
      version: topicVersion - 1,
      requestKey: requestKey(),
    },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, "VERSION_CONFLICT");
  const rename = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/topics/" + topicId,
    headers: auth(adminToken),
    payload: {
      name: secondName,
      status: "inactive",
      version: topicVersion,
      requestKey: requestKey(),
    },
  });
  assert.equal(rename.statusCode, 409);
  assert.equal(rename.json().error.code, "TOPIC_EXISTS");
  const missing = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/topics/missing-" + prefix,
    headers: auth(adminToken),
    payload: {
      name: "不存在话题",
      status: "active",
      version: 1,
      requestKey: requestKey(),
    },
  });
  assert.equal(missing.statusCode, 404);

  const logs = await rows(
    "SELECT id FROM admin_logs WHERE object_type='topic' AND object_id=? AND action='update'",
    [topicId],
  );
  assert.equal(logs.length, 1);
});

test("post hide locks the row, hides public entries and never duplicates logs", async () => {
  testPostId = prefix + "-post";
  const marker = "隐藏测试-" + prefix;
  await db.execute(
    "INSERT INTO posts(id,author_id,body,request_key) VALUES(?,?,?,?)",
    [testPostId, memberId, marker, testPostId],
  );
  createdPostIds.add(testPostId);
  await db.execute("INSERT INTO post_cats(post_id,cat_id) VALUES(?,?)", [
    testPostId,
    firstCatId,
  ]);
  await db.execute("INSERT INTO post_topics(post_id,topic_id) VALUES(?,?)", [
    testPostId,
    topicId,
  ]);
  const search = "/api/v1/posts?q=" + encodeURIComponent(marker);
  assert(
    (await app.inject(search))
      .json()
      .data.items.some((p: { id: string }) => p.id === testPostId),
  );
  assert(
    (await app.inject("/api/v1/posts?catId=" + firstCatId))
      .json()
      .data.items.some((p: { id: string }) => p.id === testPostId),
  );
  assert.equal(
    (await app.inject("/api/v1/posts/" + testPostId)).statusCode,
    200,
  );

  const input: HidePost = { reason: "  违规内容  ", requestKey: requestKey() };
  const request = () =>
    app.inject({
      method: "PUT",
      url: `/api/v1/admin/posts/${testPostId}/hide`,
      headers: auth(adminToken),
      payload: input,
    });
  const response = await request();
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().data, { id: testPostId, status: "hidden" });

  assert(
    !(await app.inject(search))
      .json()
      .data.items.some((p: { id: string }) => p.id === testPostId),
  );
  assert(
    !(await app.inject("/api/v1/posts?catId=" + firstCatId))
      .json()
      .data.items.some((p: { id: string }) => p.id === testPostId),
  );
  assert(
    !(await app.inject("/api/v1/posts?topicId=" + topicId))
      .json()
      .data.items.some((p: { id: string }) => p.id === testPostId),
  );
  assert(
    !(await app.inject("/api/v1/posts/hot"))
      .json()
      .data.items.some((p: { id: string }) => p.id === testPostId),
  );
  assert.equal(
    (await app.inject("/api/v1/posts/" + testPostId)).statusCode,
    404,
  );

  const logs = async () =>
    rows<{ action: string; reason: string | null }>(
      "SELECT action,reason FROM admin_logs WHERE object_type='post' AND object_id=?",
      [testPostId],
    );
  assert.deepEqual(
    (await logs()).map((l) => ({ action: l.action, reason: l.reason })),
    [{ action: "hide", reason: "违规内容" }],
  );

  const replay = await request();
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json().data, { id: testPostId, status: "hidden" });
  const conflict = await app.inject({
    method: "PUT",
    url: `/api/v1/admin/posts/${testPostId}/hide`,
    headers: auth(adminToken),
    payload: { reason: "不同原因", requestKey: input.requestKey },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, "IDEMPOTENCY_CONFLICT");
  const again = await app.inject({
    method: "PUT",
    url: `/api/v1/admin/posts/${testPostId}/hide`,
    headers: auth(adminToken),
    payload: { reason: "再次隐藏", requestKey: requestKey() },
  });
  assert.equal(again.statusCode, 200);
  assert.equal((await logs()).length, 1);

  const deleted = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/posts/demo-post-deleted/hide",
    headers: auth(adminToken),
    payload: { reason: "已删除", requestKey: requestKey() },
  });
  assert.equal(deleted.statusCode, 404);
  const missing = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/posts/missing-" + prefix + "/hide",
    headers: auth(adminToken),
    payload: { reason: "不存在", requestKey: requestKey() },
  });
  assert.equal(missing.statusCode, 404);

  const optionalPostId = prefix + "-post-optional-reason";
  await db.execute(
    "INSERT INTO posts(id,author_id,body,request_key) VALUES(?,?,?,?)",
    [optionalPostId, memberId, "选填原因-" + prefix, optionalPostId],
  );
  createdPostIds.add(optionalPostId);
  const optional = await app.inject({
    method: "PUT",
    url: `/api/v1/admin/posts/${optionalPostId}/hide`,
    headers: auth(adminToken),
    payload: { requestKey: requestKey() },
  });
  assert.equal(optional.statusCode, 200, optional.body);
  assert.deepEqual(optional.json().data, {
    id: optionalPostId,
    status: "hidden",
  });
  assert.deepEqual(
    (
      await rows<{ action: string; reason: string | null }>(
        "SELECT action,reason FROM admin_logs WHERE object_type='post' AND object_id=?",
        [optionalPostId],
      )
    ).map((l) => ({ action: l.action, reason: l.reason })),
    [{ action: "hide", reason: null }],
  );
  const tooLong = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/posts/" + optionalPostId + "/hide",
    headers: auth(adminToken),
    payload: { reason: "长".repeat(501), requestKey: requestKey() },
  });
  assert.equal(tooLong.statusCode, 400);
});

test("admin list includes inactive topics and other admins may retain existing cat photos", async () => {
  const result = await app.inject({
    url: "/api/v1/admin/topics",
    headers: auth(adminToken),
  });
  assert.equal(result.statusCode, 200);
  assert(
    result
      .json()
      .data.items.some((t: any) => t.id === topicId && t.status === "inactive"),
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/admin/topics",
        headers: auth(memberToken),
      })
    ).statusCode,
    403,
  );
  const current = (await app.inject("/api/v1/cats/" + firstCatId)).json().data;
  const response = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/cats/" + firstCatId,
    headers: auth(otherAdminToken),
    payload: {
      ...catInput(requestKey()),
      name: current.name,
      photoRefs: current.photoRefs,
      version: current.version,
    },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().data.photoRefs, current.photoRefs);
});
