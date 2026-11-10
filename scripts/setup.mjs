import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  let text = readFileSync(".env.example", "utf8");
  for (const key of ["DB_PASSWORD", "MYSQL_ROOT_PASSWORD", "DEV_LOGIN_KEY"])
    text = text.replace(
      `${key}=\n`,
      `${key}=${randomBytes(24).toString("hex")}\n`,
    );
  writeFileSync(".env", text, { mode: 0o600 });
}
console.log(
  "Local .env ready; credentials are not printed. Dev login remains disabled.",
);
