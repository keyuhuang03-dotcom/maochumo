import { rows } from "../../common/db";
import { FastifyInstance } from "fastify";
import {
  CreateArea,
  CreateCat,
  CreateTopic,
  HidePost,
  UpdateArea,
  UpdateCat,
  UpdateTopic,
} from "../../../../contracts";
import { admin } from "../../common/auth";
import { ok } from "../../common/http";
import { idSchema, postParams, requestKeySchema } from "../../common/schemas";
import {
  createArea,
  createCat,
  createTopic,
  hidePost,
  updateArea,
  updateCat,
  updateTopic,
} from "./service";

const idParams = {
  type: "object",
  required: ["id"],
  properties: { id: idSchema },
  additionalProperties: false,
};
const regionSchema = {
  type: "object",
  required: ["x", "y", "width", "height"],
  properties: {
    x: { type: "number", minimum: 0, maximum: 1 },
    y: { type: "number", minimum: 0, maximum: 1 },
    width: { type: "number", minimum: 0, maximum: 1 },
    height: { type: "number", minimum: 0, maximum: 1 },
  },
  additionalProperties: false,
};
const catFields = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  areaId: idSchema,
  aliases: {
    type: "array",
    items: { type: "string", maxLength: 100 },
    maxItems: 50,
  },
  photoRefs: { type: "array", items: idSchema, maxItems: 9, uniqueItems: true },
  sex: { enum: ["male", "female", "unknown"] },
  appearance: {
    anyOf: [{ type: "null" }, { type: "string", maxLength: 1000 }],
  },
  personality: {
    anyOf: [{ type: "null" }, { type: "string", maxLength: 1000 }],
  },
  requestKey: requestKeySchema,
};
const catRequired = [
  "name",
  "areaId",
  "aliases",
  "photoRefs",
  "sex",
  "appearance",
  "personality",
  "requestKey",
];
const createCatBody = {
  type: "object",
  required: catRequired,
  properties: catFields,
  additionalProperties: false,
};
const updateCatBody = {
  ...createCatBody,
  required: [...catRequired, "version"],
  properties: {
    ...catFields,
    version: { type: "integer", minimum: 1 },
  },
};
const areaFields = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  region: regionSchema,
  requestKey: requestKeySchema,
};
const areaRequired = ["name", "region", "requestKey"];
const createAreaBody = {
  type: "object",
  required: areaRequired,
  properties: areaFields,
  additionalProperties: false,
};
const updateAreaBody = {
  ...createAreaBody,
  required: [...areaRequired, "version"],
  properties: {
    ...areaFields,
    version: { type: "integer", minimum: 1 },
  },
};
const topicFields = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  status: { enum: ["active", "inactive"] },
  requestKey: requestKeySchema,
};
const topicRequired = ["name", "status", "requestKey"];
const createTopicBody = {
  type: "object",
  required: topicRequired,
  properties: topicFields,
  additionalProperties: false,
};
const updateTopicBody = {
  ...createTopicBody,
  required: [...topicRequired, "version"],
  properties: {
    ...topicFields,
    version: { type: "integer", minimum: 1 },
  },
};
const hidePostBody = {
  type: "object",
  required: ["requestKey"],
  properties: {
    reason: { type: "string", maxLength: 500 },
    requestKey: requestKeySchema,
  },
  additionalProperties: false,
};

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (r) => {
    await admin(r);
  });
  app.get("/api/v1/admin/topics", async (r) =>
    ok(r, {
      items: await rows(
        "SELECT id,name,status,version FROM topics ORDER BY id",
      ),
    }),
  );
  app.post<{ Body: CreateCat }>(
    "/api/v1/admin/cats",
    { schema: { body: createCatBody } },
    async (r) => {
      const user = await admin(r);
      return ok(r, await createCat(user.id, r.body));
    },
  );
  app.put<{ Params: { id: string }; Body: UpdateCat }>(
    "/api/v1/admin/cats/:id",
    { schema: { params: idParams, body: updateCatBody } },
    async (r) => {
      const user = await admin(r);
      return ok(r, await updateCat(user.id, r.params.id, r.body));
    },
  );
  app.post<{ Body: CreateArea }>(
    "/api/v1/admin/areas",
    { schema: { body: createAreaBody } },
    async (r) => {
      const user = await admin(r);
      return ok(r, await createArea(user.id, r.body));
    },
  );
  app.put<{ Params: { id: string }; Body: UpdateArea }>(
    "/api/v1/admin/areas/:id",
    { schema: { params: idParams, body: updateAreaBody } },
    async (r) => {
      const user = await admin(r);
      return ok(r, await updateArea(user.id, r.params.id, r.body));
    },
  );
  app.post<{ Body: CreateTopic }>(
    "/api/v1/admin/topics",
    { schema: { body: createTopicBody } },
    async (r) => {
      const user = await admin(r);
      return ok(r, await createTopic(user.id, r.body));
    },
  );
  app.put<{ Params: { id: string }; Body: UpdateTopic }>(
    "/api/v1/admin/topics/:id",
    { schema: { params: idParams, body: updateTopicBody } },
    async (r) => {
      const user = await admin(r);
      return ok(r, await updateTopic(user.id, r.params.id, r.body));
    },
  );
  app.put<{ Params: { postId: string }; Body: HidePost }>(
    "/api/v1/admin/posts/:postId/hide",
    { schema: { params: postParams, body: hidePostBody } },
    async (r) => {
      const user = await admin(r);
      return ok(r, await hidePost(user.id, r.params.postId, r.body));
    },
  );
}
