import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import OpenCC from "opencc-js";

test("builds the family memory application", async () => {
  const [page, layout, app, css, archiveApi] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MemoryApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/archive/route.ts", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);

  assert.match(page, /<MemoryApp \/>/);
  assert.match(layout, /岁月留声｜家庭记忆档案/);
  assert.match(app, /开始一次访谈/);
  assert.match(app, /确认内容并归档/);
  assert.match(app, /导出完整档案/);
  assert.match(app, /memory-loom-chinese-script/);
  assert.match(app, /简体/);
  assert.match(app, /繁體/);
  assert.match(app, /toSimplified\(result\[0\]\.transcript\)/);
  assert.match(archiveApi, /simplifyData/);
  assert.match(css, /--green:\s*#315f4b/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|Your site is taking shape/);
});

test("converts recorded Traditional Chinese to canonical Simplified Chinese", () => {
  const toSimplified = OpenCC.Converter({ from: "t", to: "cn" });
  const toTraditional = OpenCC.Converter({ from: "cn", to: "t" });

  const simplified = toSimplified("餵餵餵，那我說話嗎？上學後開始記錄。");
  assert.equal(simplified, "喂喂喂，那我说话吗？上学后开始记录。");
  assert.equal(
    toTraditional(simplified),
    "喂喂喂，那我說話嗎？上學後開始記錄。",
  );
});
