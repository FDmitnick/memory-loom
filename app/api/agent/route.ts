import { getRuntimeEnv } from "@/db/memory-store";
import { simplifyData, toSimplified } from "@/lib/chinese";

type AgentRequest = {
  kind?: "plan" | "organize" | "followup";
  elder?: {
    name?: string;
    relationship?: string;
    birthYear?: string;
    birthPlace?: string;
    personality?: string;
    boundaries?: string;
  };
  theme?: string;
  durationMinutes?: number;
  transcript?: string;
};

const THEME_QUESTIONS: Record<string, string[]> = {
  "童年与故乡": [
    "你小时候住的房子是什么样子的？",
    "家里每天通常是谁最早起床？",
    "小时候最喜欢去的地方在哪里？",
    "那时过年，家里会做哪些特别的准备？",
    "小时候有没有一件让你特别骄傲的事？",
    "如果可以回去看一天，你最想回到哪一天？",
  ],
  "求学与成长": [
    "你第一次去学校时，还记得那天发生了什么吗？",
    "读书时最喜欢或最害怕哪一门课？",
    "有没有一位老师对你影响很深？",
    "年轻时，你觉得自己将来会成为怎样的人？",
    "那段时间最要好的朋友是谁？",
    "如果现在见到当时的自己，你想对他说什么？",
  ],
  "工作与迁徙": [
    "你的第一份工作是怎么找到的？",
    "第一次领到工资时，你把钱花在了哪里？",
    "有没有一次离开家乡的经历让你印象很深？",
    "工作中谁曾经帮助过你？",
    "哪件工作上的事让你觉得自己很有价值？",
    "后来回头看，哪次选择改变了你的人生方向？",
  ],
  "爱情与家庭": [
    "你第一次见到伴侣时，对方是什么样子？",
    "你们年轻时通常会一起做什么？",
    "结婚那天有哪些细节还记得？",
    "成为父母以后，最不习惯的事情是什么？",
    "家里遇到困难时，你们通常怎样商量？",
    "你觉得一个家最重要的是什么？",
  ],
  "人生选择": [
    "你人生中做过最勇敢的一次决定是什么？",
    "有没有一段很难熬、最后还是走过来的日子？",
    "哪件事情改变了你对生活的看法？",
    "有什么事情是年轻时在意、现在已经不在意的？",
    "你最感谢人生中的哪一个人？",
    "你希望晚辈记住怎样的生活道理？",
  ],
};

function fallbackPlan(body: AgentRequest) {
  const theme = body.theme || "童年与故乡";
  const base = THEME_QUESTIONS[theme] ?? THEME_QUESTIONS["童年与故乡"];
  const count = (body.durationMinutes ?? 20) <= 15 ? 4 : 6;
  const name = body.elder?.name || "长辈";
  return {
    mode: "guided",
    opening: `今天先陪${name}聊聊“${theme}”。不赶时间，任何问题都可以跳过。`,
    questions: base.slice(0, count),
    preparation:
      theme === "童年与故乡"
        ? "可以准备一张老家、旧房子或小时候的照片。"
        : "可以准备一件与这段经历有关的旧物或照片。",
    careNote: "如果长辈出现疲惫、沉默或明显情绪波动，先停下来陪伴，不追问原因。",
  };
}

function fallbackOrganize(transcript: string, theme: string) {
  const normalized = transcript.replace(/\s+/g, " ").trim();
  const chunks = normalized
    .split(/[。！？!?]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 8);
  const year = normalized.match(/(?:19|20)\d{2}年|[一二三四五六七八九零〇]{4}年/)?.[0];
  const body = chunks.slice(0, 5).join("。") || normalized || "这次访谈还没有文字记录。";
  const quote = chunks.find((part) => part.length <= 60) ?? "";

  return {
    summary: normalized
      ? `这次围绕“${theme}”留下了一段口述记录，内容涉及长辈当时的生活经历和感受。`
      : "录音已经保存，等待补充或校正文字记录。",
    stories: [
      {
        id: crypto.randomUUID(),
        title: normalized ? `${theme}的一段记忆` : "待补充的记忆",
        body,
        timeLabel: year || "时间待确认",
        location: "",
        people: "",
        quote,
      },
    ],
    followUps: normalized
      ? ["这件事大约发生在哪一年？", "当时还有谁在场？", "你那时心里是什么感受？"]
      : ["可以在安静时重新播放录音，补充一段简短文字。"],
    source: "基础整理",
  };
}

async function callOpenAI(body: AgentRequest) {
  const apiKey = getRuntimeEnv().OPENAI_API_KEY;
  if (!apiKey) return null;

  const isPlan = body.kind === "plan";
  const instructions = isPlan
    ? `你是温和的家庭口述史访谈顾问。根据长辈资料生成一次中文访谈计划。
不要医疗诊断，不要求回答敏感问题。返回严格JSON：
{"opening":"开场白","preparation":"准备建议","careNote":"照顾提醒","questions":["问题"]}`
    : `你是严谨的家庭口述史整理员。只能依据访谈原文，不得补造事实。
不确定的信息标记“待确认”。返回严格JSON：
{"summary":"摘要","stories":[{"id":"随机字符串","title":"标题","body":"忠于原意的故事","timeLabel":"时间或待确认","location":"","people":"","quote":"原话短句"}],"followUps":["下次可追问"]}`;

  const input = isPlan
    ? JSON.stringify({
        elder: body.elder,
        theme: body.theme,
        durationMinutes: body.durationMinutes,
      })
    : JSON.stringify({ theme: body.theme, transcript: body.transcript?.slice(0, 50000) });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      instructions,
      input,
      text: { format: { type: "json_object" } },
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { output_text?: string };
  if (!data.output_text) return null;
  return simplifyData(
    JSON.parse(data.output_text) as Record<string, unknown>,
  );
}

export async function POST(request: Request) {
  try {
    const body = simplifyData((await request.json()) as AgentRequest);
    const aiResult = await callOpenAI(body).catch(() => null);
    if (aiResult) {
      return Response.json(simplifyData({ ...aiResult, source: "AI整理" }));
    }

    if (body.kind === "plan") {
      return Response.json(fallbackPlan(body));
    }
    return Response.json(
      fallbackOrganize(
        toSimplified(body.transcript ?? ""),
        toSimplified(body.theme || "一次访谈"),
      ),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "整理失败" },
      { status: 500 },
    );
  }
}
