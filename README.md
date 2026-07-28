# Memory Loom · 岁月留声

> A private oral-history companion for listening to, recording, and preserving
> the life stories of older family members.
>
> 一个帮助家庭认真倾听、记录并保存长辈生命故事的私人口述史工具。

![Memory Loom social preview](public/og.png)

[English](#english) · [中文](#中文)

---

## English

### What is Memory Loom?

Memory Loom helps one family member interview one elder at a time. It turns a
gentle conversation into a durable private archive containing the original
recording, a corrected transcript, story cards, and a searchable life timeline.

It is not a chatbot that impersonates a deceased relative. The agent assists
with listening, follow-up questions, and organization while keeping the elder's
original words distinguishable from generated summaries.

### Current status

Memory Loom is an early, usable MVP designed for:

- one interviewer;
- one elder profile;
- a private, owner-only deployment;
- short interviews of roughly 15–30 minutes.

It is **not yet ready for public multi-user or multi-family deployment**. The
current data model does not isolate records by account.

### Core workflow

1. Create an elder profile.
2. Choose a theme and interview duration.
3. Generate a gentle interview plan.
4. Record the conversation on a phone.
5. Review and correct the live transcript.
6. Confirm the summary and story cards.
7. Browse stories on a timeline or search the archive.
8. Export everything, including recordings, as a ZIP file.

### Features

- Theme-based interview planning
- Adaptive follow-up prompts during the conversation
- Mobile browser audio recording
- Live Chinese speech recognition when supported by the browser
- Simplified Chinese by default, with a saved Simplified/Traditional display switch
- Automatic Simplified Chinese normalization before transcripts are saved
- Editable transcript and summary
- Human-confirmed story cards and life timeline
- Search by time, place, person, or phrase
- Private audio storage
- Full ZIP export of structured data and recordings
- Two-step permanent deletion

### Product principles

- The original recording is never overwritten by AI.
- Generated text becomes part of the archive only after human confirmation.
- Uncertain facts should be marked as “to be confirmed.”
- Sensitive questions may always be skipped.
- The agent supports human conversation; it does not impersonate a relative.
- Families must be able to export and delete their own data.

### Technology

- React 19
- Next.js-compatible App Router via
  [vinext](https://github.com/cloudflare/vinext)
- Cloudflare Workers
- Cloudflare D1 for structured records
- Cloudflare R2 for audio recordings
- Drizzle ORM and migrations
- Browser `MediaRecorder` and optional Web Speech Recognition
- Optional OpenAI API integration for interview planning and story organization

### Local development

#### Requirements

- Node.js `>=22.13.0`
- pnpm

#### Start the app

```bash
pnpm install
pnpm dev
```

Then open the local URL printed by the development server.

The local vinext environment simulates the declared D1 and R2 bindings from
`.openai/hosting.json`.

#### Optional AI organization

The product works without an API key by using its built-in interview templates
and basic deterministic organization. To enable model-assisted interview plans
and story organization, set:

```bash
OPENAI_API_KEY=your_key
```

Do not commit real API keys or `.env` files.

The current OpenAI integration does **not** perform audio transcription. Live
transcription is provided by the browser when available; otherwise the recording
is preserved and the transcript can be entered manually.

### Useful commands

```bash
pnpm dev          # Start local development
pnpm lint         # Run code checks
pnpm test         # Build and run the project test
pnpm build        # Create the production build
pnpm db:generate  # Generate a Drizzle migration after schema changes
```

### Data model

- `elders`: elder profile and interview boundaries
- `interviews`: plans, transcripts, summaries, recording metadata, confirmation
- `stories`: confirmed story cards used by search and the timeline
- R2 objects: original interview recordings

### Privacy and deployment warning

The hosted MVP relies on an owner-only site access policy. Its API routes do not
yet implement per-user authorization, and its records do not include an owner
identifier.

Before making the app public or inviting multiple families:

1. add server-side authentication and authorization to every data route;
2. add an immutable owner or household ID to all records and audio objects;
3. add consent, retention, and privacy-policy flows;
4. review the treatment of voice recordings under applicable local law;
5. add encrypted backups and a tested recovery process.

### Known limitations

- Browser speech recognition support and quality vary by device.
- Long recordings are not resumable and are uploaded only after the interview.
- The current MVP supports one elder profile.
- Dates, places, and people are not yet normalized into dedicated entities.
- There is no collaborative family review or invitation flow.
- AI-generated organization may be incomplete and must be reviewed.
- Automated end-to-end microphone testing is not included.

### Recommended next milestone

Run a small real-world pilot with 3–5 families before adding major features.
Observe the complete first-interview journey and measure:

- whether an interview can begin within five minutes;
- completion rate and average interview length;
- transcription correction time;
- how often suggested questions feel helpful or intrusive;
- whether users trust the archive enough to save real recordings;
- whether anyone returns to replay or reread a memory.

The first engineering priority after that pilot should be reliable
post-recording transcription and recoverable uploads, not family trees,
avatars, or voice cloning.

### License

No open-source license has been selected yet. Until a license is added, the
source is publicly visible but no reuse permission is granted by default.

---

## 中文

### Memory Loom 是什么？

Memory Loom（岁月留声）帮助一位家庭成员采访一位长辈，把一次温和的聊天
整理成可以长期保存的私人档案，包括原始录音、经确认的文字记录、故事卡片
和可搜索的人生时间线。

它不是一个模仿逝去亲人的聊天机器人。Agent 只负责辅助倾听、提示追问和
整理内容，并始终区分长辈原话、家人确认内容和机器生成的摘要。

### 当前阶段

这是一个可以真实使用的早期 MVP，当前面向：

- 一位采访者；
- 一位长辈档案；
- 仅本人可访问的私人部署；
- 每次约 15～30 分钟的短访谈。

它目前**不适合直接作为公开、多用户、多家庭产品上线**，因为现有数据模型
还没有按照账号或家庭隔离资料。

### 核心流程

1. 建立长辈档案；
2. 选择访谈主题和时长；
3. 生成温和的访谈方案；
4. 使用手机录制谈话；
5. 校正实时生成的文字草稿；
6. 确认摘要和故事卡；
7. 通过时间线或搜索重新查看；
8. 将文字和全部录音打包导出为 ZIP。

### 当前功能

- 按主题生成访谈提纲
- 根据谈话内容提示追问方向
- 手机浏览器录音
- 浏览器支持时进行中文实时语音识别
- 默认使用简体中文，并支持记住“简体 / 繁體”显示切换
- 识别文字和档案内容在保存前统一规范为简体中文
- 编辑和校正原话、摘要
- 经人工确认的故事卡和人生时间线
- 按时间、地点、人物和关键词搜索
- 私人云端录音保存
- 完整导出结构化资料和录音
- 二次确认后永久删除

### 产品原则

- AI 永远不覆盖原始录音；
- 机器生成内容必须经过用户确认才能进入正式档案；
- 不确定的时间和事实应标记为“待确认”；
- 长辈可以跳过任何不愿回答的问题；
- Agent 帮助人与人交流，不冒充亲人；
- 家庭始终可以完整导出和删除自己的资料。

### 技术栈

- React 19
- 基于 [vinext](https://github.com/cloudflare/vinext) 的 App Router
- Cloudflare Workers
- Cloudflare D1：结构化档案
- Cloudflare R2：访谈录音
- Drizzle ORM 与数据库迁移
- 浏览器 `MediaRecorder` 与可选的 Web Speech Recognition
- 可选的 OpenAI API：访谈计划和故事整理

### 本地开发

#### 环境要求

- Node.js `>=22.13.0`
- pnpm

#### 启动项目

```bash
pnpm install
pnpm dev
```

然后打开开发服务器输出的本地地址。

本地 vinext 环境会模拟 `.openai/hosting.json` 中声明的 D1 和 R2 绑定。

#### 可选的 AI 整理能力

没有模型密钥时，产品仍可使用内置题库和基础规则完成访谈及整理。要启用
模型辅助的访谈方案和故事整理，可在本地设置：

```bash
OPENAI_API_KEY=your_key
```

不要把真实密钥或 `.env` 文件提交到仓库。

目前 OpenAI 接口**不负责录音转写**。实时文字依赖浏览器语音识别；如果
浏览器不支持，录音仍会完整保存，用户可以手动补充文字。

### 常用命令

```bash
pnpm dev          # 启动本地开发
pnpm lint         # 运行代码检查
pnpm test         # 构建并执行测试
pnpm build        # 生成生产构建
pnpm db:generate  # 数据库结构变化后生成迁移
```

### 数据结构

- `elders`：长辈资料和访谈边界
- `interviews`：提纲、文字、摘要、录音信息和确认状态
- `stories`：用于搜索与时间线的已确认故事卡
- R2 对象：原始访谈录音

### 隐私与部署提醒

当前线上 MVP 依赖“仅网站所有者可访问”的站点权限。API 路由本身尚未实现
逐用户授权，数据记录中也没有所有者字段。

在公开产品或邀请多个家庭使用之前，必须：

1. 为每个数据接口增加服务端身份认证和权限校验；
2. 为所有档案和录音增加不可变的用户或家庭 ID；
3. 增加录音同意、保存期限和隐私政策流程；
4. 根据使用地区审查声音资料相关法律要求；
5. 建立加密备份并实际演练恢复流程。

### 已知限制

- 不同手机和浏览器的语音识别能力、质量存在差异；
- 长录音不支持断点续传，当前在访谈结束后统一上传；
- 首版仅支持一位长辈；
- 时间、地点和人物还没有拆分成独立实体；
- 暂无家庭成员邀请和协作校对；
- AI 整理可能遗漏或误解内容，必须人工确认；
- 尚未包含真实麦克风的自动化端到端测试。

### 建议的下一阶段

在继续增加大功能前，先找 3～5 个家庭完成真实访谈试用。观察完整的
“第一次访谈”过程，并记录：

- 用户能否在五分钟内开始访谈；
- 访谈完成率和平均时长；
- 校正转写需要多长时间；
- 追问提示是有帮助还是造成打扰；
- 用户是否愿意把真实录音保存在系统中；
- 用户之后是否回来听过或看过某段记忆。

试用之后，第一项工程投入应该是“可靠的录音后转写和可恢复上传”，而不是
家庭树、数字人或声音克隆。

### 许可证

仓库目前尚未选择开源许可证。在添加许可证之前，源代码虽然公开可见，但
默认并不授予他人复制、修改或分发权限。
