import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { config } from "../../config";
export const imageUrl = (id: string) =>
  `${config.publicBase}/api/v1/media/${encodeURIComponent(id)}`;
/** Only generated UUID keys are accepted; never resolve a client filename. */
const location = (key: string) => {
  if (!/^[a-f0-9-]{36}\.png$/.test(key)) throw new Error("Invalid storage key");
  return join(resolve(config.uploadDir), key);
};
export const localStorage = {
  async put(key: string, buffer: Buffer) {
    await mkdir(resolve(config.uploadDir), { recursive: true });
    await writeFile(location(key), buffer, { flag: "wx", mode: 0o600 });
  },
  get: (key: string) => readFile(location(key)),
  async remove(key: string) {
    await unlink(location(key)).catch(() => {});
  },
};
