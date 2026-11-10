import { buildApp } from "./app";
import { config } from "./config";
import { db } from "./common/db";
const app = buildApp();
app
  .listen({ host: config.host, port: config.port })
  .then(() =>
    console.log(
      `API listening at http://${config.host}:${config.port}; mode=${config.env}`,
    ),
  )
  .catch(() => {
    console.error("Server failed to start. Check local environment and port.");
    process.exitCode = 1;
  });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    await db.end();
    process.exit(0);
  });
