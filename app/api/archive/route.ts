import { ensureMemorySchema, getRuntimeEnv } from "@/db/memory-store";
import { simplifyData, toSimplified } from "@/lib/chinese";

type StoryInput = {
  id?: string;
  title?: string;
  body?: string;
  timeLabel?: string;
  location?: string;
  people?: string;
  quote?: string;
};

function clean(value: unknown, max = 10000) {
  return typeof value === "string"
    ? toSimplified(value).trim().slice(0, max)
    : "";
}

export async function GET() {
  try {
    await ensureMemorySchema();
    const { DB } = getRuntimeEnv();
    const [elderResult, interviewResult, storyResult] = await Promise.all([
      DB.prepare("SELECT * FROM elders ORDER BY created_at DESC LIMIT 1").all(),
      DB.prepare("SELECT * FROM interviews ORDER BY created_at DESC").all(),
      DB.prepare("SELECT * FROM stories ORDER BY created_at DESC").all(),
    ]);

    return Response.json(simplifyData({
      elder: elderResult.results[0] ?? null,
      interviews: interviewResult.results,
      stories: storyResult.results,
    }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "档案读取失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureMemorySchema();
    const { DB } = getRuntimeEnv();
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (action === "save-elder") {
      const elder = (body.elder ?? {}) as Record<string, unknown>;
      const id = clean(elder.id, 80) || crypto.randomUUID();
      const name = clean(elder.name, 80);
      const relationship = clean(elder.relationship, 80);
      if (!name || !relationship) {
        return Response.json({ error: "请填写称呼和关系" }, { status: 400 });
      }

      await DB.prepare(
        `INSERT INTO elders (
          id, name, relationship, birth_year, birth_place, personality, boundaries, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          relationship=excluded.relationship,
          birth_year=excluded.birth_year,
          birth_place=excluded.birth_place,
          personality=excluded.personality,
          boundaries=excluded.boundaries,
          updated_at=CURRENT_TIMESTAMP`,
      )
        .bind(
          id,
          name,
          relationship,
          clean(elder.birthYear, 20),
          clean(elder.birthPlace, 120),
          clean(elder.personality, 500),
          clean(elder.boundaries, 1000),
        )
        .run();

      return Response.json({ ok: true, id });
    }

    if (action === "confirm-interview") {
      const interview = (body.interview ?? {}) as Record<string, unknown>;
      const elderId = clean(interview.elderId, 80);
      const id = clean(interview.id, 80) || crypto.randomUUID();
      if (!elderId) {
        return Response.json({ error: "缺少长辈档案" }, { status: 400 });
      }

      const stories = Array.isArray(body.stories)
        ? (body.stories as StoryInput[]).slice(0, 20)
        : [];

      await DB.prepare(
        `INSERT INTO interviews (
          id, elder_id, theme, duration_minutes, questions_json, transcript,
          summary, audio_key, audio_type, status, confirmed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          theme=excluded.theme,
          duration_minutes=excluded.duration_minutes,
          questions_json=excluded.questions_json,
          transcript=excluded.transcript,
          summary=excluded.summary,
          audio_key=excluded.audio_key,
          audio_type=excluded.audio_type,
          status='confirmed',
          confirmed_at=CURRENT_TIMESTAMP`,
      )
        .bind(
          id,
          elderId,
          clean(interview.theme, 100) || "一次访谈",
          Math.max(5, Math.min(90, Number(interview.durationMinutes) || 20)),
          JSON.stringify(
            Array.isArray(interview.questions) ? interview.questions.slice(0, 20) : [],
          ),
          clean(interview.transcript, 100000),
          clean(interview.summary, 5000),
          clean(interview.audioKey, 300),
          clean(interview.audioType, 100),
        )
        .run();

      await DB.prepare("DELETE FROM stories WHERE interview_id = ?").bind(id).run();
      if (stories.length) {
        await DB.batch(
          stories.map((story) =>
            DB.prepare(
              `INSERT INTO stories (
                id, interview_id, title, body, time_label, location, people, quote
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(
              clean(story.id, 80) || crypto.randomUUID(),
              id,
              clean(story.title, 160) || "一段珍贵的记忆",
              clean(story.body, 20000),
              clean(story.timeLabel, 100) || "时间待确认",
              clean(story.location, 160),
              clean(story.people, 300),
              clean(story.quote, 500),
            ),
          ),
        );
      }

      return Response.json({ ok: true, id });
    }

    return Response.json({ error: "不支持的操作" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await ensureMemorySchema();
    const { DB, RECORDINGS } = getRuntimeEnv();
    const audioRows = await DB.prepare(
      "SELECT audio_key FROM interviews WHERE audio_key != ''",
    ).all<{ audio_key: string }>();

    await Promise.all(
      audioRows.results.map((row) => RECORDINGS.delete(row.audio_key)),
    );
    await DB.batch([
      DB.prepare("DELETE FROM stories"),
      DB.prepare("DELETE FROM interviews"),
      DB.prepare("DELETE FROM elders"),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 },
    );
  }
}
