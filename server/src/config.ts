import "dotenv/config";
export const config = {
  env: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  devAuth: process.env.DEV_AUTH_ENABLED === "true",
  devKey: process.env.DEV_LOGIN_KEY ?? "",
  db: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? "maochumo",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "maochumo_demo",
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    connectionLimit: 5,
  },
};
if (
  config.devAuth &&
  (config.env !== "development" ||
    config.host !== "127.0.0.1" ||
    config.devKey.length < 32)
)
  throw new Error(
    "Dev auth requires development, loopback HOST and a local key of at least 32 characters",
  );
