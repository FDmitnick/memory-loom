import { ensureMemorySchema, getRuntimeEnv } from "@/db/memory-store";

const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await ensureMemorySchema();
    const form = await request.formData();
    const audio = form.get("audio");
    const interviewId = String(form.get("interviewId") ?? "").slice(0, 80);
    if (!(audio instanceof File) || !interviewId) {
      return Response.json({ error: "缺少录音文件" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json(
        { error: "单次录音暂不能超过24MB，请缩短访谈时间" },
        { status: 413 },
      );
    }

    const { RECORDINGS } = getRuntimeEnv();
    const audioKey = `interviews/${interviewId}/${Date.now()}.webm`;
    await RECORDINGS.put(audioKey, audio.stream(), {
      httpMetadata: { contentType: audio.type || "audio/webm" },
    });

    return Response.json({
      ok: true,
      audioKey,
      audioType: audio.type || "audio/webm",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "录音保存失败" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !key.startsWith("interviews/")) {
      return new Response("Not found", { status: 404 });
    }
    const object = await getRuntimeEnv().RECORDINGS.get(key);
    if (!object) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, max-age=3600");
    headers.set("content-disposition", 'inline; filename="memory.webm"');
    return new Response(object.body, { headers });
  } catch {
    return new Response("Audio unavailable", { status: 500 });
  }
}
