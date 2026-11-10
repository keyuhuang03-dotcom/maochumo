import { FastifyInstance } from "fastify";
import { Area, Cat } from "../../../../contracts";
import { rows } from "../../common/db";
import {
  ListQuery,
  listQuery,
  ok,
  paginate,
  unavailable,
} from "../../common/http";
export async function catalogRoutes(app: FastifyInstance) {
  app.get("/api/v1/areas", async (r) =>
    ok(r, {
      items: await rows<Area>(
        "SELECT id,name,region,version FROM areas ORDER BY id",
      ),
    }),
  );
  app.get<{ Querystring: ListQuery }>(
    "/api/v1/cats",
    { schema: { querystring: listQuery } },
    async (r) => {
      const q = r.query;
      const args: (string | number)[] = [];
      const where = ["1=1"];
      if (q.areaId) {
        where.push("area_id=?");
        args.push(q.areaId);
      }
      if (q.q) {
        where.push("(name LIKE ? OR JSON_SEARCH(aliases,'one',?) IS NOT NULL)");
        args.push("%" + q.q + "%", "%" + q.q + "%");
      }
      const data = await rows<Cat>(
        `SELECT id,name,area_id AS areaId,aliases,photo_refs AS photoRefs,sex,appearance,personality,version FROM cats WHERE ${where.join(" AND ")} ORDER BY id LIMIT ${q.pageSize + 1} OFFSET ${(q.page - 1) * q.pageSize}`,
        args,
      );
      return ok(r, paginate(data, q));
    },
  );
  app.get<{ Params: { catId: string } }>("/api/v1/cats/:catId", async (r) => {
    const [cat] = await rows<Cat>(
      "SELECT id,name,area_id AS areaId,aliases,photo_refs AS photoRefs,sex,appearance,personality,version FROM cats WHERE id=?",
      [r.params.catId],
    );
    if (!cat) return unavailable();
    return ok(r, cat);
  });
  app.get("/api/v1/topics", async (r) =>
    ok(r, {
      items: await rows(
        "SELECT id,name,version FROM topics WHERE status='active' ORDER BY id",
      ),
    }),
  );
}
