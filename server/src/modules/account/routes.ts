import { FastifyInstance } from "fastify";
import { identity } from "../../common/auth";
import { pending } from "../../common/http";
export async function accountRoutes(app: FastifyInstance) {
  for (const url of [
    "/api/v1/me/posts",
    "/api/v1/me/likes",
    "/api/v1/me/notifications",
    "/api/v1/me/notifications/unread-count",
  ])
    app.get(url, async (r) => {
      await identity(r);
      return pending();
    });
  for (const url of [
    "/api/v1/me/notifications/:notificationId/read",
    "/api/v1/me/notifications/read-all",
  ])
    app.put(url, async (r) => {
      await identity(r);
      return pending();
    });
}
