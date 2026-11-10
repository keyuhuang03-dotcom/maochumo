import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
// Use tsc only for TS -> JS; WXML/WXSS are compiled by WeChat DevTools later.
const result = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "miniprogram/tsconfig.json"],
  { stdio: "inherit" },
);
if (result.status) process.exit(result.status);
rmSync("dist/miniprogram", { recursive: true, force: true });
mkdirSync("dist/miniprogram", { recursive: true });
cpSync("dist/mini-build/miniprogram", "dist/miniprogram", { recursive: true });
function copy(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) copy(p);
    else if (
      /\.(json|wxml|wxss|png|jpg|svg)$/.test(p) &&
      !p.endsWith("tsconfig.json")
    ) {
      const dest = p.replace(/^miniprogram/, "dist/miniprogram");
      mkdirSync(join(dest, ".."), { recursive: true });
      cpSync(p, dest);
    }
  }
}
copy("miniprogram");
const app = JSON.parse(readFileSync("miniprogram/app.json", "utf8"));
for (const path of app.pages)
  for (const ext of ["js", "json", "wxml", "wxss"])
    if (!existsSync(`dist/miniprogram/${path}.${ext}`))
      throw new Error("Missing page file: " + path + "." + ext);
if (app.tabBar.list.length !== 5) throw new Error("Expected five tabs");
for (const path of Object.values(app.usingComponents))
  for (const ext of ["js", "json", "wxml", "wxss"])
    if (!existsSync(`dist/miniprogram${path}.${ext}`))
      throw new Error("Missing component: " + path);
// Local config is deliberately excluded from version control; only public client values belong here.
if (existsSync("miniprogram/core/env.local.ts"))
  cpSync(
    "dist/mini-build/miniprogram/core/env.local.js",
    "dist/miniprogram/core/env.js",
  );
console.log(
  `Mini JS build and manifest checks passed: ${app.pages.length} pages, 5 tabs. WXML/WXSS platform compile still requires DevTools.`,
);
