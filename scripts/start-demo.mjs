import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["--import", "tsx", "server/src/index.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      DEV_AUTH_ENABLED: "true",
      UPLOAD_DRIVER: "local",
    },
  },
);
console.log(
  "Local demo only: development identity and local image storage enabled. No WeChat verification is implied.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
