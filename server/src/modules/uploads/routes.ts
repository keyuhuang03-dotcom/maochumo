import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import sharp from "sharp";
import { identity } from "../../common/auth";
import { db, rows } from "../../common/db";
import { ApiError, ok, unavailable } from "../../common/http";
import { config } from "../../config";
import { imageUrl, localStorage } from "./storage";
export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: {
      fileSize: 8 * 1024 * 1024,
      files: 1,
      fields: 0,
      parts: 1,
      fieldSize: 256,
    },
  });
  app.post<{ Querystring: { purpose: "post" | "avatar" | "cat" } }>(
    "/api/v1/uploads",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            purpose: { enum: ["post", "avatar", "cat"], default: "post" },
          },
        },
      },
    },
    async (r) => {
      const user = await identity(r);
      if (config.uploadDriver !== "local")
        throw new ApiError(503, "UPLOAD_NOT_CONFIGURED", "图片存储未启用");
      if (r.query.purpose === "cat" && user.role !== "admin")
        throw new ApiError(403, "FORBIDDEN", "只有管理员可以上传猫咪档案图片");
      if (!r.isMultipart())
        throw new ApiError(400, "INVALID_UPLOAD", "请上传 multipart 图片文件");
      let input: Buffer;
      try {
        let fileCount = 0;
        input = Buffer.alloc(0);
        for await (const part of r.parts()) {
          if (part.type !== "file" || part.fieldname !== "file")
            throw new Error("Invalid file");
          fileCount++;
          input = await part.toBuffer();
        }
        if (fileCount !== 1 || !input.length) throw new Error("Missing file");
      } catch {
        throw new ApiError(400, "INVALID_UPLOAD", "请选择一张不超过8MB的图片");
      }
      let output: Buffer;
      try {
        const image = sharp(input, {
          limitInputPixels: 20000000,
          failOn: "warning",
        });
        const meta = await image.metadata();
        if (
          !["jpeg", "png", "webp"].includes(meta.format || "") ||
          (meta.pages || 1) !== 1
        )
          throw new Error("Unsupported image");
        output = await image
          .rotate()
          .resize({
            width: 2048,
            height: 2048,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
      } catch {
        throw new ApiError(
          400,
          "INVALID_IMAGE",
          "仅支持有效的静态JPEG、PNG、WebP，像素不超过2000万",
        );
      }
      const id = randomUUID(),
        key = id + ".png";
      await localStorage.put(key, output);
      try {
        await db.execute(
          "INSERT INTO assets(id,owner_id,purpose,storage_key,mime_type,byte_size,status) VALUES(?,?,?,?,?,?,'ready')",
          [id, user.id, r.query.purpose, key, "image/png", output.length],
        );
      } catch (e) {
        await localStorage.remove(key);
        throw e;
      }
      return ok(r, { imageRef: id, url: imageUrl(id) });
    },
  );
  app.get<{ Params: { id: string } }>("/api/v1/media/:id", async (r, reply) => {
    if (config.uploadDriver !== "local") return unavailable();
    const [asset] = await rows<{ ownerId: string; key: string }>(
      "SELECT owner_id AS ownerId,storage_key AS `key` FROM assets WHERE id=? AND status='ready'",
      [r.params.id],
    );
    if (!asset) return unavailable();
    const visible =
      (
        await rows(
          `SELECT a.id FROM assets a WHERE a.id=? AND (EXISTS(SELECT 1 FROM post_images pi JOIN posts p ON p.id=pi.post_id WHERE pi.image_ref=a.id AND p.status='published') OR EXISTS(SELECT 1 FROM users u WHERE u.avatar_ref=a.id AND u.status='active') OR EXISTS(SELECT 1 FROM cats c WHERE JSON_CONTAINS(c.photo_refs,JSON_QUOTE(a.id))))`,
          [r.params.id],
        )
      ).length > 0;
    if (!visible) {
      if (
        (
          await rows(
            "SELECT post_id FROM post_images WHERE image_ref=? LIMIT 1",
            [r.params.id],
          )
        ).length
      )
        return unavailable();
      if (!r.headers.authorization) return unavailable();
      if ((await identity(r)).id !== asset.ownerId) return unavailable();
    }
    let bytes: Buffer;
    try {
      bytes = await localStorage.get(asset.key);
    } catch {
      return unavailable();
    }
    return reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .type("image/png")
      .send(bytes);
  });
}
