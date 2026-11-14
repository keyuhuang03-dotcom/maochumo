import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
const environment = {
  ...process.env,
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  DEV_AUTH_ENABLED: "true",
  UPLOAD_DRIVER: "local",
};
const port = Number(process.env.PORT || 3000);
const base = `http://127.0.0.1:${port}`;
const database = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "maochumo",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "maochumo_demo",
  connectTimeout: 2000,
};
async function databaseReady() {
  const c = await mysql.createConnection(database);
  try {
    await c.query("SELECT 1");
  } finally {
    await c.end();
  }
}
function run(args) {
  const result = spawnSync(process.execPath, args, {
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("准备失败，请按上方提示修复后重试");
}
async function main() {
  if (!existsSync(".env"))
    throw new Error("缺少本机.env，请先运行 npm run setup 并配置数据库");
  if ((process.env.DEV_LOGIN_KEY || "").length < 32)
    throw new Error(
      "本机DEV_LOGIN_KEY缺失或过短，请在.env设置至少32位的开发口令",
    );
  try {
    const response = await fetch(base + "/health", {
      signal: AbortSignal.timeout(1500),
    });
    const result = await response.json();
    if (result.ok && result.data.service === "maochumo") {
      const capabilities = await (
        await fetch(base + "/api/v1/capabilities", {
          signal: AbortSignal.timeout(1500),
        })
      ).json();
      if (
        !capabilities.ok ||
        !capabilities.data.developmentLogin ||
        !capabilities.data.localUpload
      )
        throw new Error(
          "端口上的猫出没不是Demo模式，请先停止旧后端，再运行启动入口",
        );
      console.log(`猫出没已运行：${base}。可回开发者工具重新编译。`);
      return;
    }
    throw new Error("端口已有其它服务，请更改本项目PORT和客户端地址");
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("端口")) throw e;
  }
  try {
    await databaseReady();
  } catch (error) {
    const dir = resolve(".local/mysql-dev");
    const executable = "/usr/local/mysql/bin/mysqld";
    if (
      error.code !== "ECONNREFUSED" ||
      database.host !== "127.0.0.1" ||
      database.port !== 3307 ||
      !database.database.endsWith("_demo") ||
      !existsSync(dir) ||
      !existsSync(executable)
    )
      throw new Error(
        "数据库不可连接。请检查DB配置，或启动 Docker 后运行 npm run db:up；不会修改其它数据库",
      );
    console.log("正在恢复本项目独立 MySQL…");
    const child = spawn(
      executable,
      [
        "--no-defaults",
        `--datadir=${dir}`,
        `--socket=${resolve(".local/mysql.sock")}`,
        "--port=3307",
        "--bind-address=127.0.0.1",
        "--mysqlx=OFF",
        `--pid-file=${resolve(".local/mysql.pid")}`,
        `--log-error=${resolve(".local/mysql.log")}`,
      ],
      { detached: true, stdio: "ignore" },
    );
    child.on("error", () => {});
    child.unref();
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        await databaseReady();
        ready = true;
        break;
      } catch {}
    }
    if (!ready) throw new Error("本项目MySQL未能启动，请查看.local/mysql.log");
  }
  run(["--import", "tsx", "server/scripts/migrate.ts"]);
  run(["--import", "tsx", "server/seeds/demo.ts"]);
  run(["scripts/build-mini.mjs"]);
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/src/index.ts"],
    { stdio: "inherit", env: environment },
  );
  console.log(
    "本机Demo：数据库已检查、小程序已构建、开发身份和真实本地上传已启用。请保持这个窗口打开。",
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("后端进程未能启动");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
