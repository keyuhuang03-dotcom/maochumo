import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";
// Use tsc only for TS -> JS; WXML/WXSS are compiled by WeChat DevTools later.
const result = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "miniprogram/tsconfig.json"],
  { stdio: "inherit" },
);
if (result.status) process.exit(result.status);
rmSync("dist/mini-stage", { recursive: true, force: true });
mkdirSync("dist/mini-stage", { recursive: true });
cpSync("dist/mini-build/miniprogram", "dist/mini-stage", { recursive: true });
function copy(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) copy(p);
    else if (
      /\.(json|wxml|wxss|png|jpg|svg)$/.test(p) &&
      !p.endsWith("tsconfig.json")
    ) {
      const dest = p.replace(/^miniprogram/, "dist/mini-stage");
      mkdirSync(join(dest, ".."), { recursive: true });
      cpSync(p, dest);
    }
  }
}
copy("miniprogram");
const app = JSON.parse(readFileSync("miniprogram/app.json", "utf8"));
for (const path of app.pages)
  for (const ext of ["js", "json", "wxml", "wxss"])
    if (!existsSync(`dist/mini-stage/${path}.${ext}`))
      throw new Error("Missing page file: " + path + "." + ext);
if (app.tabBar.list.length !== 5) throw new Error("Expected five tabs");
for (const path of Object.values(app.usingComponents))
  for (const ext of ["js", "json", "wxml", "wxss"])
    if (!existsSync(`dist/mini-stage${path}.${ext}`))
      throw new Error("Missing component: " + path);
// Local config is deliberately excluded from version control; only public client values belong here.
if (existsSync("miniprogram/core/env.local.ts"))
  cpSync(
    "dist/mini-build/miniprogram/core/env.local.js",
    "dist/mini-stage/core/env.js",
  );
console.log(
  `Mini JS build and manifest checks passed: ${app.pages.length} pages, 5 tabs. WXML/WXSS platform compile still requires DevTools.`,
);

mkdirSync("dist/mini-stage/shared", { recursive: true });
cpSync(
  "dist/mini-build/contracts/index.js",
  "dist/mini-stage/shared/contracts.js",
);
function relocate(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) relocate(p);
    else if (e.name.endsWith(".js")) {
      const target = relative(
        dirname(p),
        "dist/mini-stage/shared/contracts",
      ).replaceAll("\\", "/");
      const code = readFileSync(p, "utf8").replace(
        /require\(["'](?:\.\.\/)+contracts(?:\/index)?["']\)/g,
        () => `require('${target.startsWith(".") ? target : "./" + target}')`,
      );
      writeFileSync(p, code);
    }
  }
}
relocate("dist/mini-stage");

// Publish complete files without deleting the watched project directory. Update the manifest last.
const publish = [];
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else publish.push(path);
  }
}
collect("dist/mini-stage");
publish.sort(
  (a, b) =>
    Number(a === "dist/mini-stage/app.json") -
    Number(b === "dist/mini-stage/app.json"),
);
for (const source of publish) {
  const target = source.replace("dist/mini-stage", "dist/miniprogram");
  if (existsSync(target) && readFileSync(target).equals(readFileSync(source)))
    continue;
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + ".pending";
  cpSync(source, temporary);
  renameSync(temporary, target);
}
