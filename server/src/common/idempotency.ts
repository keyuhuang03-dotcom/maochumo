import { createHash } from "node:crypto";
import { PoolConnection } from "mysql2/promise";
import { rows, transaction } from "./db";
import { ApiError } from "./http";
/** Serialize same-actor writes before locking target rows. Store replay result in the business transaction. */
export async function once<T extends object>(
  actor: string,
  scope: string,
  key: string,
  payload: unknown,
  work: (c: PoolConnection) => Promise<T>,
): Promise<T> {
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return transaction(async (c) => {
    await rows("SELECT id FROM users WHERE id=? FOR UPDATE", [actor], c);
    const [done] = await rows<{ hash: string; result: T }>(
      "SELECT request_hash AS hash,response_json AS result FROM idempotency_keys WHERE actor_id=? AND scope=? AND request_key=?",
      [actor, scope, key],
      c,
    );
    if (done) {
      if (done.hash !== hash)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "同一请求标识不能用于不同内容",
        );
      return done.result;
    }
    const result = await work(c);
    await c.execute(
      "INSERT INTO idempotency_keys(actor_id,scope,request_key,request_hash,response_json) VALUES(?,?,?,?,?)",
      [actor, scope, key, hash, JSON.stringify(result)],
    );
    return result;
  });
}
