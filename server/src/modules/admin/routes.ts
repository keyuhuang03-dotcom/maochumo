import { FastifyInstance } from "fastify";
import { admin } from "../../common/auth";
import { pending } from "../../common/http";
export async function adminRoutes(app: FastifyInstance) {
  for (const resource of ["cats", "areas", "topics"]) {
    app.post(`/api/v1/admin/${resource}`, async (r) => {
      await admin(r);
      return pending();
    });
    app.put(`/api/v1/admin/${resource}/:id`, async (r) => {
      await admin(r);
      return pending();
    });
  }
  app.put("/api/v1/admin/posts/:postId/hide", async (r) => {
    await admin(r);
    return pending();
  });
}
