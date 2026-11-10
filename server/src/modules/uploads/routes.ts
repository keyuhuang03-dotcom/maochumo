import { FastifyInstance } from "fastify";
import { identity } from "../../common/auth";
import { ApiError } from "../../common/http";
/** Boundary only. Must validate magic bytes, size, purpose, owner and committed asset state before enabling. */
export async function uploadRoutes(app: FastifyInstance) {
  app.post("/api/v1/uploads", async (r) => {
    await identity(r);
    throw new ApiError(
      503,
      "UPLOAD_NOT_CONFIGURED",
      "图片存储尚未接入，未保存任何图片",
    );
  });
}
