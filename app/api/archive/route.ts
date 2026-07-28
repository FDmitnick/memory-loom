import { getRuntimeEnv } from "@/db/memory-store";
import {
  canEdit,
  DEFAULT_FAMILY_ID,
  getFamilyViewer,
} from "@/db/family-access";
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

export async function GET(request: Request) {
  try {
    const viewer = await getFamilyViewer(request);
    if (!viewer) {
      return Response.json({ error: "你还不是这个家庭空间的成员" }, { status: 403 });
    }
    const { DB } = getRuntimeEnv();
    const [familyResult, memberResult, elderResult, interviewResult, storyResult] =
      await Promise.all([
      DB.prepare("SELECT * FROM family_spaces WHERE id = ?")
        .bind(DEFAULT_FAMILY_ID)
        .first(),
      DB.prepare(
        `SELECT id, email, name, role, status, created_at, last_seen_at
         FROM family_members
         WHERE family_id = ?
         ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'contributor' THEN 1 ELSE 2 END,
                  created_at`,
      )
        .bind(DEFAULT_FAMILY_ID)
        .all(),
      DB.prepare("SELECT * FROM elders ORDER BY created_at DESC").all(),
      DB.prepare("SELECT * FROM interviews ORDER BY created_at DESC").all(),
      DB.prepare("SELECT * FROM stories ORDER BY created_at DESC").all(),
    ]);

    return Response.json(simplifyData({
      family: familyResult,
      members: memberResult.results,
      viewer,
      elders: elderResult.results,
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
    const viewer = await getFamilyViewer(request);
    if (!viewer) {
      return Response.json({ error: "你还不是这个家庭空间的成员" }, { status: 403 });
    }
    const { DB } = getRuntimeEnv();
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (action === "save-family") {
      if (viewer.role !== "admin") {
        return Response.json({ error: "只有管理员可以修改家庭空间" }, { status: 403 });
      }
      const name = clean(body.name, 80);
      if (!name) {
        return Response.json({ error: "请填写家庭空间名称" }, { status: 400 });
      }
      await DB.prepare(
        `UPDATE family_spaces
         SET name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
        .bind(name, DEFAULT_FAMILY_ID)
        .run();
      return Response.json({ ok: true });
    }

    if (action === "invite-member") {
      if (viewer.role !== "admin") {
        return Response.json({ error: "只有管理员可以邀请成员" }, { status: 403 });
      }
      const email = clean(body.email, 180).toLowerCase();
      const name = clean(body.name, 80) || email.split("@")[0];
      const role = body.role === "contributor" ? "contributor" : "viewer";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
      }
      await DB.prepare(
        `INSERT INTO family_members (
          id, family_id, email, name, role, status
        ) VALUES (?, ?, ?, ?, ?, 'invited')
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          role = excluded.role`,
      )
        .bind(
          crypto.randomUUID(),
          DEFAULT_FAMILY_ID,
          email,
          name,
          role,
        )
        .run();
      return Response.json({ ok: true });
    }

    if (action === "remove-member") {
      if (viewer.role !== "admin") {
        return Response.json({ error: "只有管理员可以移除成员" }, { status: 403 });
      }
      const memberId = clean(body.memberId, 80);
      if (!memberId || memberId === viewer.id) {
        return Response.json({ error: "不能移除当前管理员" }, { status: 400 });
      }
      await DB.prepare(
        "DELETE FROM family_members WHERE id = ? AND family_id = ? AND role != 'admin'",
      )
        .bind(memberId, DEFAULT_FAMILY_ID)
        .run();
      return Response.json({ ok: true });
    }

    if (action === "save-elder") {
      if (!canEdit(viewer.role)) {
        return Response.json({ error: "你没有编辑长辈档案的权限" }, { status: 403 });
      }
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
      if (!canEdit(viewer.role)) {
        return Response.json({ error: "你没有归档访谈的权限" }, { status: 403 });
      }
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

export async function DELETE(request: Request) {
  try {
    const viewer = await getFamilyViewer(request);
    if (!viewer || viewer.role !== "admin") {
      return Response.json({ error: "只有管理员可以删除全部资料" }, { status: 403 });
    }
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
