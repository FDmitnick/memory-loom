# Memory Loom · 岁月留声

> A private space for speaking freely, preserving original recordings, and
> turning everyday thoughts into a searchable personal memory archive.
>
> 一个可以随时说话、保留原始声音，并把回忆与感悟整理成个人档案的私人空间。

![Memory Loom social preview](public/og.png)

[English](#english) · [中文](#中文)

---

## English

### What is Memory Loom?

Memory Loom is a private memory and reflection companion for one person. You can
record a voice note or write freely without choosing a category first. The
assistant preserves the original words, suggests a title and summary, identifies
useful context, and files the entry only after confirmation.

It currently recognizes five flexible entry types:

- past memories;
- life reflections;
- everyday moments;
- memories about people;
- ideas and inspirations.

Family oral-history interviews remain available as an optional guided mode.
They are no longer required before using the product.

### Core workflow

1. Tap **Start speaking** or **Write instead**.
2. Record whatever is on your mind.
3. Review and correct the transcript.
4. Let the assistant suggest a title, summary, category, tags, time, people,
   place, and mood.
5. Confirm or edit every field.
6. Save the entry to the private memory library.
7. Search later by a phrase, person, place, category, or tag.

### Product principles

- The space is private and owner-only by default.
- Original recordings and original words remain separate from AI summaries.
- AI organization is never accepted without user confirmation.
- The assistant must not invent facts, experiences, or opinions.
- Categories are suggestions, not requirements.
- Guided elder interviews are optional.
- All records and recordings can be exported.

### Technology

- React 19 and a Next.js-compatible App Router via
  [vinext](https://github.com/cloudflare/vinext)
- Cloudflare Workers
- Cloudflare D1 for structured personal entries and interview records
- Cloudflare R2 for original recordings
- Browser `MediaRecorder` and optional Web Speech Recognition
- Optional OpenAI API assistance for organization and interview planning
- OpenCC-based Simplified/Traditional Chinese display switching

### Local development

Requirements: Node.js `>=22.13.0` and pnpm.

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm db:generate
```

The product works without an OpenAI key by using a deterministic local
organizer. Model-assisted organization can be enabled with:

```bash
OPENAI_API_KEY=your_key
```

Do not commit real API keys or `.env` files.

### Storage

- `memory_entries`: private voice and text memories, summaries, categories, and
  extracted context
- `elders`, `interviews`, `stories`: optional guided oral-history mode
- R2 objects: original personal recordings and interview recordings

### Current limitations

- Live transcription quality and support vary by browser.
- Audio is uploaded after recording and does not yet support resumable upload.
- Speaker separation is not yet available.
- AI suggestions must always be reviewed.
- The hosted MVP is intended for a private owner-only deployment, not a public
  multi-user service.

---

## 中文

### 岁月留声是什么？

岁月留声是一个默认仅自己使用的个人记忆与思考空间。你不需要先选择分类，
只要录下一段声音或写下一段话。系统会保留原始录音和原话，再建议标题、摘要、
类别、标签、时间、人物、地点和感受，经过你确认后才会进入记忆库。

目前支持五种灵活的内容类型：

- 过去记忆；
- 生活感悟；
- 当下日常；
- 人物片段；
- 灵感想法。

原来的长辈口述史能力仍然保留为可选的“长辈采访模式”，不再是使用产品的前提。

### 核心流程

1. 点击“开始说话”或“用文字记录”；
2. 想到什么就记录什么；
3. 检查并修改文字草稿；
4. 让系统建议标题、摘要、分类、标签和相关信息；
5. 修改或确认整理结果；
6. 保存到仅自己可见的记忆库；
7. 日后通过一句话、一个人、地点、分类或标签重新找到。

### 产品原则

- 默认只有账号本人可以访问；
- 原始录音、原话和 AI 摘要始终分开保存；
- AI 整理必须经过本人确认；
- 不补造事实、经历和观点；
- 分类只是建议，不要求记录前做选择；
- 长辈采访是可选模式；
- 所有文字和录音都可以完整导出。

### 技术栈

- React 19
- 基于 [vinext](https://github.com/cloudflare/vinext) 的 App Router
- Cloudflare Workers
- Cloudflare D1：个人记录、访谈和故事资料
- Cloudflare R2：个人录音和访谈原始录音
- 浏览器 `MediaRecorder` 与可选的 Web Speech Recognition
- 可选 OpenAI API：个人记录整理和访谈计划
- OpenCC 简体 / 繁体显示转换

### 本地开发

需要 Node.js `>=22.13.0` 和 pnpm。

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm lint
pnpm test
pnpm build
pnpm db:generate
```

没有模型密钥时，产品仍可以使用内置规则完成基础整理。要启用模型辅助整理：

```bash
OPENAI_API_KEY=your_key
```

不要提交真实密钥或 `.env` 文件。

### 存储方案

- `memory_entries`：个人原话、摘要、分类、标签和上下文
- `elders`、`interviews`、`stories`：可选的长辈采访模式
- R2 对象：个人记录和长辈访谈的原始录音

### 当前限制

- 不同浏览器的实时语音识别能力和准确率不同；
- 录音结束后统一上传，暂不支持断点续传；
- 暂不支持自动区分多位说话人；
- AI 整理必须人工确认；
- 当前线上版本适合仅本人访问，不适合作为公开多用户服务。

### 许可证

仓库尚未选择开源许可证。在添加许可证之前，源代码虽然公开可见，但默认不授予
他人复制、修改或分发权限。
