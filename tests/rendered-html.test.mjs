import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import OpenCC from "opencc-js";

test("builds the private personal memory application", async () => {
  const [page, layout, personalApp, interviewApp, css, memoriesApi, agentApi, memoryStore] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PersonalMemoryApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MemoryApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/memories/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/memory-store.ts", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);

  assert.match(page, /<PersonalMemoryApp \/>/);
  assert.match(layout, /岁月留声｜我的私人记忆空间/);
  assert.match(personalApp, /此刻，你想/);
  assert.match(personalApp, /让 AI 帮我整理/);
  assert.match(personalApp, /过去记忆/);
  assert.match(personalApp, /生活感悟/);
  assert.match(personalApp, /原始录音与AI摘要始终分开保存/);
  assert.match(personalApp, /memory-loom-chinese-script/);
  assert.match(personalApp, /简体/);
  assert.match(personalApp, /繁體/);
  assert.match(interviewApp, /开始一次访谈/);
  assert.match(interviewApp, /确认内容并归档/);
  assert.match(memoriesApi, /owner_email/);
  assert.match(memoriesApi, /memory_entries/);
  assert.match(agentApi, /personal-organize/);
  assert.match(agentApi, /私人记忆整理员/);
  assert.match(memoryStore, /CREATE TABLE IF NOT EXISTS memory_entries/);
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
