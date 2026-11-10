import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { db, rows } from "../src/common/db";
async function main() {
  const c = await db.getConnection();
  try {
    const [lock] = await rows<{ locked: number }>(
      "SELECT GET_LOCK('maochumo_migrate',10) AS locked",
      [],
      c,
    );
    if (lock.locked !== 1) throw new Error("Migration lock unavailable");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name VARCHAR(255) PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    for (const name of (await readdir("server/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile("server/migrations/" + name, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const [done] = await rows<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name=?",
        [name],
        c,
      );
      if (done) {
        if (done.checksum !== hash)
          throw new Error("Applied migration changed: " + name);
        console.log("Already applied: " + name);
        continue;
      }
      // MySQL DDL commits implicitly. A failed migration must be inspected; do not blindly rerun or edit an applied file.
      for (const statement of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await c.query(statement);
      await c.execute(
        "INSERT INTO schema_migrations(name,checksum) VALUES(?,?)",
        [name, hash],
      );
      console.log("Applied: " + name);
    }
  } finally {
    await c.query("SELECT RELEASE_LOCK('maochumo_migrate')");
    c.release();
    await db.end();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Check DB access/schema; DDL is not transactional.",
  );
  process.exitCode = 1;
});
