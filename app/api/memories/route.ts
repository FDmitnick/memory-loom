import { getFamilyViewer } from "@/db/family-access";
import { getRuntimeEnv } from "@/db/memory-store";
import { simplifyData, toSimplified } from "@/lib/chinese";

type MemoryInput = {
  id?: string;
  title?: string;
  originalText?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  occurredAt?: string;
  people?: string;
  place?: string;
  mood?: string;
  audioKey?: string;
  audioType?: string;
};

const CATEGORIES = new Set([
  "过去记忆",
  "生活感悟",
  "当下日常",
  "人物片段",
  "灵感想法",
]);

function clean(value: unknown, max = 10000) {
  return typeof value === "string"
    ? toSimplified(value).trim().slice(0, max)
    : "";
}

export async function GET(request: Request) {
  try {
    const viewer = await getFamilyViewer(request);
    if (!viewer) {
      return Response.json({ error: "请先登录你的私人空间" }, { status: 403 });
    }
    const result = await getRuntimeEnv().DB.prepare(
      `SELECT * FROM memory_entries
       WHERE owner_email = ?
       ORDER BY created_at DESC`,
    )
      .bind(viewer.email)
      .all();
    return Response.json(
      simplifyData({ entries: result.results, viewer }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "个人记录读取失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await getFamilyViewer(request);
    if (!viewer) {
      return Response.json({ error: "请先登录你的私人空间" }, { status: 403 });
    }
    const body = (await request.json()) as { entry?: MemoryInput };
    const entry = body.entry ?? {};
    const id = clean(entry.id, 80) || crypto.randomUUID();
    const originalText = clean(entry.originalText, 100000);
    const summary = clean(entry.summary, 12000);
    const title = clean(entry.title, 160) || "一段还没有标题的记录";
    const category = clean(entry.category, 40);
    const tags = Array.isArray(entry.tags)
      ? entry.tags.map((tag) => clean(tag, 40)).filter(Boolean).slice(0, 12)
      : [];

    if (!originalText && !summary && !entry.audioKey) {
      return Response.json({ error: "还没有可以保存的内容" }, { status: 400 });
    }

    await getRuntimeEnv().DB.prepare(
      `INSERT INTO memory_entries (
        id, owner_email, title, original_text, summary, category, tags_json,
        occurred_at, people, place, mood, audio_key, audio_type, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        original_text = excluded.original_text,
        summary = excluded.summary,
        category = excluded.category,
        tags_json = excluded.tags_json,
        occurred_at = excluded.occurred_at,
        people = excluded.people,
        place = excluded.place,
        mood = excluded.mood,
        audio_key = CASE
          WHEN excluded.audio_key = '' THEN memory_entries.audio_key
          ELSE excluded.audio_key
        END,
        audio_type = CASE
          WHEN excluded.audio_type = '' THEN memory_entries.audio_type
          ELSE excluded.audio_type
        END,
        updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(
        id,
        viewer.email,
        title,
        originalText,
        summary,
        CATEGORIES.has(category) ? category : "当下日常",
        JSON.stringify(tags),
        clean(entry.occurredAt, 80),
        clean(entry.people, 300),
        clean(entry.place, 200),
        clean(entry.mood, 80),
        clean(entry.audioKey, 300),
        clean(entry.audioType, 100),
      )
      .run();

    return Response.json({ ok: true, id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "个人记录保存失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const viewer = await getFamilyViewer(request);
    if (!viewer) {
      return Response.json({ error: "请先登录你的私人空间" }, { status: 403 });
    }
    const id = clean(new URL(request.url).searchParams.get("id"), 80);
    const row = await getRuntimeEnv().DB.prepare(
      `SELECT audio_key FROM memory_entries
       WHERE id = ? AND owner_email = ?`,
    )
      .bind(id, viewer.email)
      .first<{ audio_key: string }>();
    if (!row) return Response.json({ error: "记录不存在" }, { status: 404 });
    if (row.audio_key) await getRuntimeEnv().RECORDINGS.delete(row.audio_key);
    await getRuntimeEnv().DB.prepare(
      "DELETE FROM memory_entries WHERE id = ? AND owner_email = ?",
    )
      .bind(id, viewer.email)
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 },
    );
  }
}
