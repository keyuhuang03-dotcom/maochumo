import mysql, { PoolConnection, RowDataPacket } from "mysql2/promise";
import { config } from "../config";
export const db = mysql.createPool(config.db);
// mysql2 timezone controls serialization; the session must also use UTC for SQL defaults.
db.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});
export async function rows<T>(
  sql: string,
  values: (string | number | boolean | Date | null)[] = [],
  connection: PoolConnection | typeof db = db,
): Promise<T[]> {
  const [result] = await connection.execute<RowDataPacket[]>(sql, values);
  return result as T[];
}
export async function transaction<T>(
  work: (c: PoolConnection) => Promise<T>,
): Promise<T> {
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const value = await work(c);
    await c.commit();
    return value;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
