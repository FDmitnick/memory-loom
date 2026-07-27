import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the family memory application", async () => {
  const [page, layout, app, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MemoryApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);

  assert.match(page, /<MemoryApp \/>/);
  assert.match(layout, /岁月留声｜家庭记忆档案/);
  assert.match(app, /开始一次访谈/);
  assert.match(app, /确认内容并归档/);
  assert.match(app, /导出完整档案/);
  assert.match(css, /--green:\s*#315f4b/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|Your site is taking shape/);
});
