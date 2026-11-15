import { randomUUID } from "node:crypto";
import { PoolConnection, ResultSetHeader } from "mysql2/promise";
import {
  Area,
  Cat,
  CreateArea,
  CreateCat,
  CreateTopic,
  HidePost,
  Topic,
  UpdateArea,
  UpdateCat,
  UpdateTopic,
} from "../../../../contracts";
import { rows } from "../../common/db";
import { once } from "../../common/idempotency";
import { ApiError } from "../../common/http";

function catData(input: CreateCat | UpdateCat) {
  const name = input.name.trim();
  if (!name) throw new ApiError(400, "INVALID_CAT", "猫咪名称不能为空");
  return {
    name,
    areaId: input.areaId,
    aliases: [...input.aliases],
    photoRefs: [...input.photoRefs],
    sex: input.sex,
    appearance: input.appearance,
    personality: input.personality,
  };
}

function areaData(input: CreateArea | UpdateArea) {
  const name = input.name.trim();
  if (!name) throw new ApiError(400, "INVALID_AREA", "区域名称不能为空");
  const { x, y, width, height } = input.region;
  if (
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x > 1 ||
    y > 1 ||
    width > 1 ||
    height > 1 ||
    x + width > 1 ||
    y + height > 1
  )
    throw new ApiError(
      400,
      "INVALID_REGION",
      "区域范围必须是位于单位地图内的非空矩形",
    );
  return { name, region: { x, y, width, height } };
}

async function assertArea(c: PoolConnection, id: string) {
  if (
    !(await rows("SELECT id FROM areas WHERE id=? FOR SHARE", [id], c)).length
  )
    throw new ApiError(400, "INVALID_AREA", "主要活动区域不存在");
}

async function assertCatPhotos(
  c: PoolConnection,
  actor: string,
  photoRefs: string[],
  existing: string[] = [],
) {
  for (const id of photoRefs)
    if (
      !(
        await rows(
          "SELECT id FROM assets WHERE id=? AND (owner_id=? OR ?) AND purpose='cat' AND status='ready' FOR SHARE",
          [id, actor, existing.includes(id)],
          c,
        )
      ).length
    )
      throw new ApiError(
        400,
        "INVALID_IMAGE",
        "图片尚未上传、用途不符或不属于当前管理员",
      );
}

async function writeLog(
  c: PoolConnection,
  actor: string,
  objectType: "cat" | "area" | "topic" | "post",
  objectId: string,
  action: "create" | "update" | "hide",
  reason: string | null = null,
) {
  await c.execute(
    "INSERT INTO admin_logs(id,actor_id,object_type,object_id,action,reason) VALUES(?,?,?,?,?,?)",
    [randomUUID(), actor, objectType, objectId, action, reason],
  );
}

export async function createCat(actor: string, input: CreateCat): Promise<Cat> {
  const payload = catData(input);
  return once(
    actor,
    "admin:cats:create",
    input.requestKey,
    payload,
    async (c) => {
      await assertArea(c, payload.areaId);
      await assertCatPhotos(c, actor, payload.photoRefs);
      const cat: Cat = { id: randomUUID(), ...payload, version: 1 };
      await c.execute(
        "INSERT INTO cats(id,name,area_id,aliases,photo_refs,sex,appearance,personality) VALUES(?,?,?,?,?,?,?,?)",
        [
          cat.id,
          cat.name,
          cat.areaId,
          JSON.stringify(cat.aliases),
          JSON.stringify(cat.photoRefs),
          cat.sex,
          cat.appearance,
          cat.personality,
        ],
      );
      await writeLog(c, actor, "cat", cat.id, "create");
      return cat;
    },
  );
}

export async function updateCat(
  actor: string,
  id: string,
  input: UpdateCat,
): Promise<Cat> {
  const payload = { id, ...catData(input), version: input.version };
  return once(
    actor,
    "admin:cats:update",
    input.requestKey,
    payload,
    async (c) => {
      const [current] = await rows<{ version: number; photoRefs: string[] }>(
        "SELECT version,photo_refs AS photoRefs FROM cats WHERE id=? FOR UPDATE",
        [id],
        c,
      );
      if (!current) throw new ApiError(404, "NOT_FOUND", "猫咪档案不存在");
      if (Number(current.version) !== input.version)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "猫咪档案已被修改，请刷新后重试",
        );
      await assertArea(c, payload.areaId);
      await assertCatPhotos(c, actor, payload.photoRefs, current.photoRefs);
      const cat: Cat = { ...payload, version: input.version + 1 };
      const [result] = await c.execute<ResultSetHeader>(
        "UPDATE cats SET name=?,area_id=?,aliases=?,photo_refs=?,sex=?,appearance=?,personality=?,version=? WHERE id=? AND version=?",
        [
          cat.name,
          cat.areaId,
          JSON.stringify(cat.aliases),
          JSON.stringify(cat.photoRefs),
          cat.sex,
          cat.appearance,
          cat.personality,
          cat.version,
          id,
          input.version,
        ],
      );
      if (result.affectedRows !== 1)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "猫咪档案已被修改，请刷新后重试",
        );
      await writeLog(c, actor, "cat", id, "update");
      return cat;
    },
  );
}

export async function createArea(
  actor: string,
  input: CreateArea,
): Promise<Area> {
  const payload = areaData(input);
  return once(
    actor,
    "admin:areas:create",
    input.requestKey,
    payload,
    async (c) => {
      const area: Area = { id: randomUUID(), ...payload, version: 1 };
      await c.execute("INSERT INTO areas(id,name,region) VALUES(?,?,?)", [
        area.id,
        area.name,
        JSON.stringify(area.region),
      ]);
      await writeLog(c, actor, "area", area.id, "create");
      return area;
    },
  );
}

export async function updateArea(
  actor: string,
  id: string,
  input: UpdateArea,
): Promise<Area> {
  const payload = { id, ...areaData(input), version: input.version };
  return once(
    actor,
    "admin:areas:update",
    input.requestKey,
    payload,
    async (c) => {
      const [current] = await rows<{ version: number }>(
        "SELECT version FROM areas WHERE id=? FOR UPDATE",
        [id],
        c,
      );
      if (!current) throw new ApiError(404, "NOT_FOUND", "活动区域不存在");
      if (Number(current.version) !== input.version)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "活动区域已被修改，请刷新后重试",
        );
      const area: Area = { ...payload, version: input.version + 1 };
      const [result] = await c.execute<ResultSetHeader>(
        "UPDATE areas SET name=?,region=?,version=? WHERE id=? AND version=?",
        [
          area.name,
          JSON.stringify(area.region),
          area.version,
          id,
          input.version,
        ],
      );
      if (result.affectedRows !== 1)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "活动区域已被修改，请刷新后重试",
        );
      await writeLog(c, actor, "area", id, "update");
      return area;
    },
  );
}

function topicData(input: CreateTopic | UpdateTopic) {
  const name = input.name.trim();
  if (!name) throw new ApiError(400, "INVALID_TOPIC", "话题名称不能为空");
  return { name, status: input.status };
}

function duplicateTopic(e: unknown): never {
  if ((e as { code?: string }).code === "ER_DUP_ENTRY")
    throw new ApiError(409, "TOPIC_EXISTS", "话题名称已存在");
  throw e;
}

export async function createTopic(
  actor: string,
  input: CreateTopic,
): Promise<Topic> {
  const payload = topicData(input);
  return once(
    actor,
    "admin:topics:create",
    input.requestKey,
    payload,
    async (c) => {
      const topic: Topic = { id: randomUUID(), ...payload, version: 1 };
      await c
        .execute("INSERT INTO topics(id,name,status) VALUES(?,?,?)", [
          topic.id,
          topic.name,
          topic.status,
        ])
        .catch(duplicateTopic);
      await writeLog(c, actor, "topic", topic.id, "create");
      return topic;
    },
  );
}

export async function updateTopic(
  actor: string,
  id: string,
  input: UpdateTopic,
): Promise<Topic> {
  const payload = { id, ...topicData(input), version: input.version };
  return once(
    actor,
    "admin:topics:update",
    input.requestKey,
    payload,
    async (c) => {
      const [current] = await rows<{ version: number }>(
        "SELECT version FROM topics WHERE id=? FOR UPDATE",
        [id],
        c,
      );
      if (!current) throw new ApiError(404, "NOT_FOUND", "话题不存在");
      if (Number(current.version) !== input.version)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "话题已被修改，请刷新后重试",
        );
      const topic: Topic = { ...payload, version: input.version + 1 };
      const [result] = await c
        .execute<ResultSetHeader>(
          "UPDATE topics SET name=?,status=?,version=? WHERE id=? AND version=?",
          [topic.name, topic.status, topic.version, id, input.version],
        )
        .catch(duplicateTopic);
      if (result.affectedRows !== 1)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "话题已被修改，请刷新后重试",
        );
      await writeLog(c, actor, "topic", id, "update");
      return topic;
    },
  );
}

export async function hidePost(
  actor: string,
  postId: string,
  input: HidePost,
): Promise<{ id: string; status: "hidden" }> {
  const reason = (input.reason ?? "").trim();
  if (reason.length > 500)
    throw new ApiError(400, "INVALID_REASON", "隐藏原因不能超过500字");
  return once(
    actor,
    "admin:posts:hide",
    input.requestKey,
    { postId, reason },
    async (c) => {
      const [post] = await rows<{ status: string }>(
        "SELECT status FROM posts WHERE id=? FOR UPDATE",
        [postId],
        c,
      );
      if (!post || post.status === "deleted")
        throw new ApiError(404, "NOT_FOUND", "帖子不存在或已删除");
      if (post.status === "published") {
        await c.execute(
          "UPDATE posts SET status='hidden' WHERE id=? AND status='published'",
          [postId],
        );
        await writeLog(c, actor, "post", postId, "hide", reason || null);
      }
      return { id: postId, status: "hidden" as const };
    },
  );
}
