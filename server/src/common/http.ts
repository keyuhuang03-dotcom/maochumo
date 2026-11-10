import { FastifyRequest } from "fastify";
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const ok = <T>(r: FastifyRequest, data: T) => ({
  ok: true as const,
  data,
  requestId: r.id,
});
export const pending = (): never => {
  throw new ApiError(501, "NOT_IMPLEMENTED", "接口已预留，尚未实现");
};
export const unavailable = (): never => {
  throw new ApiError(404, "NOT_FOUND", "内容不可用");
};
export const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, maximum: 10000, default: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    q: { type: "string", maxLength: 100 },
    catId: { type: "string", maxLength: 64 },
    topicId: { type: "string", maxLength: 64 },
    areaId: { type: "string", maxLength: 64 },
  },
};
export interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  catId?: string;
  topicId?: string;
  areaId?: string;
}
export function paginate<T>(items: T[], q: ListQuery) {
  return {
    items: items.slice(0, q.pageSize),
    page: q.page,
    pageSize: q.pageSize,
    hasMore: items.length > q.pageSize,
  };
}
