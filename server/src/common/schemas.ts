export const idSchema = {
  type: "string",
  minLength: 1,
  maxLength: 64,
  pattern: "^[A-Za-z0-9_-]+$",
};
export const requestKeySchema = {
  type: "string",
  minLength: 8,
  maxLength: 80,
  pattern: "^[A-Za-z0-9_-]+$",
};
export const postParams = {
  type: "object",
  required: ["postId"],
  properties: { postId: idSchema },
  additionalProperties: false,
};
export const commentBody = {
  type: "object",
  additionalProperties: false,
  required: ["body", "replyToId", "requestKey"],
  properties: {
    body: { type: "string", maxLength: 2000 },
    replyToId: { anyOf: [idSchema, { type: "null" }] },
    requestKey: requestKeySchema,
  },
};
export const postBody = {
  type: "object",
  additionalProperties: false,
  required: ["body", "imageRefs", "catIds", "topicIds", "requestKey"],
  properties: {
    body: { type: "string", maxLength: 2000 },
    imageRefs: {
      type: "array",
      maxItems: 9,
      uniqueItems: true,
      items: idSchema,
    },
    catIds: { type: "array", maxItems: 50, uniqueItems: true, items: idSchema },
    topicIds: {
      type: "array",
      maxItems: 50,
      uniqueItems: true,
      items: idSchema,
    },
    requestKey: requestKeySchema,
  },
};
