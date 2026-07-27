"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { strToU8, zipSync } from "fflate";

type Screen = "home" | "profile" | "plan" | "interview" | "review" | "archive" | "settings";
type Elder = {
  id: string;
  name: string;
  relationship: string;
  birthYear: string;
  birthPlace: string;
  personality: string;
  boundaries: string;
};
type Interview = {
  id: string;
  elder_id: string;
  theme: string;
  duration_minutes: number;
  questions_json: string;
  transcript: string;
  summary: string;
  audio_key: string;
  audio_type: string;
  status: string;
  created_at: string;
};
type Story = {
  id: string;
  interview_id?: string;
  title: string;
  body: string;
  timeLabel: string;
  location: string;
  people: string;
  quote: string;
};
type ArchiveData = {
  elder: Record<string, unknown> | null;
  interviews: Interview[];
  stories: Array<Record<string, unknown> & {
    id: string;
    interview_id: string;
    title: string;
    body: string;
  }>;
};
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const THEMES = [
  { name: "童年与故乡", hint: "家、玩伴、节日与儿时光景", glyph: "故" },
  { name: "求学与成长", hint: "学校、朋友与第一次远行", glyph: "学" },
  { name: "工作与迁徙", hint: "工作、城市与人生转折", glyph: "行" },
  { name: "爱情与家庭", hint: "相遇、成家与共同生活", glyph: "家" },
  { name: "人生选择", hint: "勇气、困难与留下的话", glyph: "择" },
];
const EMPTY_ELDER: Elder = {
  id: "",
  name: "",
  relationship: "",
  birthYear: "",
  birthPlace: "",
  personality: "",
  boundaries: "",
};

function readElder(row: Record<string, unknown> | null): Elder | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    relationship: String(row.relationship ?? ""),
    birthYear: String(row.birth_year ?? ""),
    birthPlace: String(row.birth_place ?? ""),
    personality: String(row.personality ?? ""),
    boundaries: String(row.boundaries ?? ""),
  };
}

function readStory(row: ArchiveData["stories"][number]): Story {
  return {
    id: row.id,
    interview_id: row.interview_id,
    title: row.title,
    body: row.body,
    timeLabel: String(row.time_label ?? "时间待确认"),
    location: String(row.location ?? ""),
    people: String(row.people ?? ""),
    quote: String(row.quote ?? ""),
  };
}

function formatDate(value: string) {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatTimer(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MemoryApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [archive, setArchive] = useState<ArchiveData>({ elder: null, interviews: [], stories: [] });
  const [elder, setElder] = useState<Elder | null>(null);
  const [elderDraft, setElderDraft] = useState<Elder>(EMPTY_ELDER);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(THEMES[0].name);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [questions, setQuestions] = useState<string[]>([]);
  const [opening, setOpening] = useState("");
  const [preparation, setPreparation] = useState("");
  const [careNote, setCareNote] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [interviewId, setInterviewId] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [summary, setSummary] = useState("");
  const [draftStories, setDraftStories] = useState<Story[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const keepRecognizingRef = useRef(false);

  const loadArchive = useCallback(async () => {
    try {
      const response = await fetch("/api/archive", { cache: "no-store" });
      const data = (await response.json()) as ArchiveData & { error?: string };
      if (!response.ok) throw new Error(data.error || "读取失败");
      setArchive(data);
      const profile = readElder(data.elder);
      setElder(profile);
      if (profile) setElderDraft(profile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "档案读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadArchive());
  }, [loadArchive]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recognitionRef.current?.stop();
  }, []);

  const filteredStories = useMemo(() => {
    const stories = archive.stories.map(readStory);
    if (!search.trim()) return stories;
    const keyword = search.trim().toLowerCase();
    return stories.filter((story) =>
      [story.title, story.body, story.timeLabel, story.location, story.people, story.quote]
        .join(" ").toLowerCase().includes(keyword),
    );
  }, [archive.stories, search]);

  const liveSuggestions = useMemo(() => {
    const text = `${transcript} ${interimTranscript}`;
    if (!text.trim()) return ["先听完这一段，不急着接下一个问题。", "可以问一个具体的时间、地点或人物。"];
    const suggestions: string[] = [];
    if (/(小时候|年轻|那时候|当年)/.test(text)) suggestions.push("那时候你大概多大？");
    if (/(去了|搬到|离开|回来|地方|村|城)/.test(text)) suggestions.push("你还记得那个地方是什么样子吗？");
    if (/(爸爸|妈妈|父亲|母亲|爷爷|奶奶|朋友|老师|同事)/.test(text)) suggestions.push("这个人当时对你意味着什么？");
    if (/(难|怕|哭|高兴|开心|舍不得|遗憾)/.test(text)) suggestions.push("如果愿意说，当时你心里是什么感受？");
    return (suggestions.length ? suggestions : ["这件事后来怎么样了？", "还有哪个细节是你一直记得的？"]).slice(0, 2);
  }, [interimTranscript, transcript]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function saveElder(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save-elder", elder: elderDraft }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      const saved = { ...elderDraft, id: result.id ?? elderDraft.id };
      setElder(saved);
      setElderDraft(saved);
      await loadArchive();
      setScreen("home");
      flash("长辈档案已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function generatePlan() {
    if (!elder) { setScreen("profile"); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "plan", elder, theme, durationMinutes }),
      });
      const result = (await response.json()) as {
        questions?: string[]; opening?: string; preparation?: string; careNote?: string; error?: string;
      };
      if (!response.ok) throw new Error(result.error || "访谈方案生成失败");
      setQuestions(result.questions ?? []);
      setOpening(result.opening ?? "");
      setPreparation(result.preparation ?? "");
      setCareNote(result.careNote ?? "");
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "访谈方案生成失败");
    } finally {
      setBusy(false);
    }
  }

  function beginInterview() {
    setInterviewId(crypto.randomUUID());
    setQuestionIndex(0);
    setTranscript("");
    setInterimTranscript("");
    setElapsed(0);
    setAudioBlob(null);
    setSummary("");
    setDraftStories([]);
    setFollowUps([]);
    setScreen("interview");
  }

  function startRecognition() {
    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) {
        setTranscript((current) => {
          const next = `${current}${current ? "\n" : ""}${finalText.trim()}`;
          transcriptRef.current = next;
          return next;
        });
      }
      setInterimTranscript(interimText);
    };
    recognition.onerror = () => setInterimTranscript("");
    recognition.onend = () => {
      if (keepRecognizingRef.current) {
        try { recognition.start(); } catch { /* audio recording continues */ }
      }
    };
    recognitionRef.current = recognition;
    keepRecognizingRef.current = true;
    try { recognition.start(); } catch { /* manual transcript remains available */ }
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
      startRecognition();
    } catch {
      setError("无法使用麦克风。请允许浏览器访问麦克风后重试。");
    }
  }

  async function organizeMemory(currentTranscript: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "organize", elder, theme, transcript: currentTranscript }),
      });
      const result = (await response.json()) as {
        summary?: string; stories?: Story[]; followUps?: string[]; error?: string;
      };
      if (!response.ok) throw new Error(result.error || "整理失败");
      setSummary(result.summary ?? "");
      setDraftStories(result.stories ?? []);
      setFollowUps(result.followUps ?? []);
    } catch (organizeError) {
      setError(organizeError instanceof Error ? organizeError.message : "整理失败");
    } finally {
      setBusy(false);
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    keepRecognizingRef.current = false;
    recognitionRef.current?.stop();
    setInterimTranscript("");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setAudioBlob(blob);
      recorder.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      setScreen("review");
      void organizeMemory(transcriptRef.current);
    };
    recorder.stop();
  }

  async function confirmInterview() {
    if (!elder) return;
    setBusy(true);
    setError("");
    try {
      let audioKey = "";
      let audioType = "";
      if (audioBlob) {
        const form = new FormData();
        form.set("audio", audioBlob, `${interviewId}.webm`);
        form.set("interviewId", interviewId);
        const audioResponse = await fetch("/api/audio", { method: "POST", body: form });
        const audioResult = (await audioResponse.json()) as { audioKey?: string; audioType?: string; error?: string };
        if (!audioResponse.ok) throw new Error(audioResult.error || "录音保存失败");
        audioKey = audioResult.audioKey ?? "";
        audioType = audioResult.audioType ?? "";
      }
      const response = await fetch("/api/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "confirm-interview",
          interview: {
            id: interviewId, elderId: elder.id, theme, durationMinutes, questions,
            transcript, summary, audioKey, audioType,
          },
          stories: draftStories,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "归档失败");
      await loadArchive();
      setScreen("archive");
      flash("访谈、录音和故事卡已安全归档");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "归档失败");
    } finally {
      setBusy(false);
    }
  }

  async function exportArchive() {
    setBusy(true);
    setError("");
    try {
      const files: Record<string, Uint8Array> = {
        "家庭记忆档案.json": strToU8(JSON.stringify({
          exportedAt: new Date().toISOString(),
          elder: readElder(archive.elder),
          interviews: archive.interviews,
          stories: archive.stories.map(readStory),
        }, null, 2)),
      };
      for (let index = 0; index < archive.interviews.length; index += 1) {
        const item = archive.interviews[index];
        if (!item.audio_key) continue;
        const response = await fetch(`/api/audio?key=${encodeURIComponent(item.audio_key)}`);
        if (!response.ok) continue;
        files[`录音/${String(index + 1).padStart(2, "0")}-${item.theme}.webm`] =
          new Uint8Array(await response.arrayBuffer());
      }
      const zipped = zipSync(files, { level: 0 });
      const safeName = elder?.name ? `${elder.name}的家庭记忆档案` : "家庭记忆档案";
      downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), `${safeName}.zip`);
      flash("完整档案已导出");
    } catch {
      setError("导出失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteArchive() {
    if (!window.confirm("确定删除全部档案和录音吗？删除后无法恢复。")) return;
    if (window.prompt("请输入“确认删除”继续") !== "确认删除") return;
    setBusy(true);
    try {
      const response = await fetch("/api/archive", { method: "DELETE" });
      if (!response.ok) throw new Error("删除失败");
      setArchive({ elder: null, interviews: [], stories: [] });
      setElder(null);
      setElderDraft(EMPTY_ELDER);
      setScreen("home");
      flash("全部档案和录音已删除");
    } catch {
      setError("删除失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  function updateStory(index: number, patch: Partial<Story>) {
    setDraftStories((current) => current.map((story, storyIndex) =>
      storyIndex === index ? { ...story, ...patch } : story,
    ));
  }

  function navigate(next: Screen) {
    if (recording) return;
    setError("");
    setSelectedStory(null);
    setScreen(next);
  }

  if (loading) {
    return <main className="app-shell loading-screen"><div className="memory-mark">忆</div><p>正在打开家庭记忆档案……</p></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label="回到首页">
          <span className="brand-mark">忆</span><span>岁月留声</span>
        </button>
        <button className="profile-chip" onClick={() => {
          setElderDraft(elder ?? EMPTY_ELDER);
          navigate("profile");
        }}>
          <span>{elder?.name?.slice(0, 1) || "+"}</span>{elder ? elder.name : "建立档案"}
        </button>
      </header>

      {notice && <div className="toast success-toast">{notice}</div>}
      {error && <div className="toast error-toast" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

      {screen === "home" && (
        <section className="page home-page">
          <div className="home-hero">
            <p className="eyebrow">把“以后再问”，变成今天好好听</p>
            <h1>{elder ? `陪${elder.name}，慢慢聊一段过去` : "听见一个人，也留住一个家"}</h1>
            <p className="hero-copy">每次只聊一个主题。录音、原话和故事会被一起保存，任何问题都可以跳过。</p>
            <button className="primary-button hero-button" onClick={() => navigate(elder ? "plan" : "profile")}>
              <span className="round-icon">●</span>{elder ? "开始一次访谈" : "先建立长辈档案"}
            </button>
          </div>
          <div className="today-card">
            <div><span className="section-kicker">今天可以聊</span><h2>小时候住过的家</h2>
              <p>从一扇门、一顿饭、一个院子开始，具体的东西最容易唤起记忆。</p></div>
            <button className="soft-button" onClick={() => {
              setTheme("童年与故乡"); navigate(elder ? "plan" : "profile");
            }}>用这个主题</button>
          </div>
          <div className="stats-row">
            <div><strong>{archive.interviews.length}</strong><span>次访谈</span></div>
            <div><strong>{archive.stories.length}</strong><span>段故事</span></div>
            <div><strong>{archive.interviews.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0)}</strong><span>分钟记忆</span></div>
          </div>
          {archive.stories.length > 0 && <div className="recent-section">
            <div className="section-heading"><div><span className="section-kicker">最近留下的</span><h2>家庭故事</h2></div>
              <button onClick={() => navigate("archive")}>查看全部</button></div>
            <button className="story-preview" onClick={() => {
              setSelectedStory(readStory(archive.stories[0])); setScreen("archive");
            }}><span>{String(archive.stories[0].time_label ?? "待确认")}</span>
              <h3>{archive.stories[0].title}</h3><p>{archive.stories[0].body}</p></button>
          </div>}
        </section>
      )}

      {screen === "profile" && (
        <section className="page form-page">
          <button className="back-button" onClick={() => navigate("home")}>← 返回</button>
          <div className="page-title"><span className="section-kicker">第一步</span><h1>认识这位长辈</h1>
            <p>只需要几项基本信息，用来让访谈问题更贴近他。以后都可以修改。</p></div>
          <form className="profile-form" onSubmit={saveElder}>
            <label>我平时怎样称呼他？<input required value={elderDraft.name}
              onChange={(event) => setElderDraft({ ...elderDraft, name: event.target.value })}
              placeholder="例如：外婆、爸爸、三爷爷" /></label>
            <label>我们的关系<input required value={elderDraft.relationship}
              onChange={(event) => setElderDraft({ ...elderDraft, relationship: event.target.value })}
              placeholder="例如：我是她的外孙女" /></label>
            <div className="field-pair">
              <label>出生年份<input inputMode="numeric" value={elderDraft.birthYear}
                onChange={(event) => setElderDraft({ ...elderDraft, birthYear: event.target.value })}
                placeholder="大约年份也可以" /></label>
              <label>出生地<input value={elderDraft.birthPlace}
                onChange={(event) => setElderDraft({ ...elderDraft, birthPlace: event.target.value })}
                placeholder="省 / 市 / 村" /></label>
            </div>
            <label>他的性格或聊天习惯<textarea value={elderDraft.personality}
              onChange={(event) => setElderDraft({ ...elderDraft, personality: event.target.value })}
              placeholder="例如：慢热，喜欢从具体小事讲起，听力不太好" /></label>
            <label>不适合询问的内容<textarea value={elderDraft.boundaries}
              onChange={(event) => setElderDraft({ ...elderDraft, boundaries: event.target.value })}
              placeholder="例如：暂时不聊疾病、某位亲人的离世（可以留空）" /></label>
            <div className="privacy-note"><span>锁</span><p>这是一份私人档案。没有你的确认，整理结果不会成为最终记录。</p></div>
            <button className="primary-button" disabled={busy}>{busy ? "正在保存…" : "保存档案"}</button>
          </form>
        </section>
      )}

      {screen === "plan" && (
        <section className="page plan-page">
          <button className="back-button" onClick={() => navigate("home")}>← 返回</button>
          <div className="page-title"><span className="section-kicker">准备一次轻松的聊天</span>
            <h1>今天想从哪里开始？</h1><p>选一个主题就够了。问题只是路标，不必逐个问完。</p></div>
          <div className="theme-list">{THEMES.map((item) => (
            <button key={item.name} className={theme === item.name ? "theme-card active" : "theme-card"}
              onClick={() => { setTheme(item.name); setQuestions([]); }}>
              <span className="theme-glyph">{item.glyph}</span>
              <span><strong>{item.name}</strong><small>{item.hint}</small></span>
              <i>{theme === item.name ? "✓" : "›"}</i>
            </button>
          ))}</div>
          <div className="duration-control"><div><strong>预计聊天时间</strong><span>{durationMinutes}分钟</span></div>
            <input aria-label="预计聊天时间" type="range" min="10" max="40" step="5" value={durationMinutes}
              onChange={(event) => { setDurationMinutes(Number(event.target.value)); setQuestions([]); }} />
            <div className="range-labels"><span>轻松聊聊</span><span>慢慢展开</span></div>
          </div>
          {!questions.length ? (
            <button className="primary-button" onClick={generatePlan} disabled={busy}>
              {busy ? "正在准备…" : "生成今天的访谈方案"}</button>
          ) : <div className="plan-result">
            <div className="opening-card"><span>建议这样开场</span><p>“{opening}”</p></div>
            <ol className="question-list">{questions.map((question, index) =>
              <li key={question}><span>{index + 1}</span>{question}</li>)}</ol>
            <div className="prep-grid"><div><strong>准备一件东西</strong><p>{preparation}</p></div>
              <div><strong>留意他的状态</strong><p>{careNote}</p></div></div>
            <button className="primary-button" onClick={beginInterview}>我们准备好了</button>
          </div>}
        </section>
      )}

      {screen === "interview" && (
        <section className="interview-page">
          <div className="interview-top">
            <button onClick={() => {
              if (!recording || window.confirm("录音尚未保存，确定退出吗？")) {
                if (recording) { keepRecognizingRef.current = false; recognitionRef.current?.stop(); recorderRef.current?.stop(); }
                navigate("plan");
              }
            }}>×</button><span>{theme}</span>
            <div className={recording ? "recording-pill active" : "recording-pill"}><i />{formatTimer(elapsed)}</div>
          </div>
          <div className="question-stage"><span className="question-count">问题 {questionIndex + 1} / {questions.length}</span>
            <h1>{questions[questionIndex]}</h1><p>让长辈慢慢说，安静本身也是访谈的一部分。</p></div>
          <div className="suggestion-panel"><span>可以顺着追问</span>
            {liveSuggestions.map((suggestion) => <button key={suggestion}
              onClick={() => navigator.clipboard?.writeText(suggestion)}>{suggestion}</button>)}</div>
          <div className="live-transcript"><span>实时文字草稿</span><p>
            {transcript || interimTranscript ? `${transcript}${interimTranscript ? ` ${interimTranscript}` : ""}` :
              "开始录音后，支持的浏览器会在这里显示识别文字。录音结束后可以校正。"}</p></div>
          <div className="interview-controls">
            <button className="skip-button" onClick={() => setQuestionIndex((current) =>
              current === 0 ? questions.length - 1 : current - 1)}>上一个</button>
            {!recording ? <button className="record-button" onClick={startRecording}><i /><span>开始录音</span></button> :
              <button className="record-button stop" onClick={stopRecording}><i /><span>结束访谈</span></button>}
            <button className="skip-button" onClick={() => setQuestionIndex((current) => (current + 1) % questions.length)}>换一个</button>
          </div>
        </section>
      )}

      {screen === "review" && (
        <section className="page review-page">
          <button className="back-button" onClick={() => navigate("plan")}>← 暂不归档</button>
          <div className="page-title"><span className="section-kicker">访谈完成 · {formatTimer(elapsed)}</span>
            <h1>先确认，再留下</h1><p>AI整理只是草稿。请校正原话和事实，尤其是时间、地点和人物。</p></div>
          {audioBlob && <div className="audio-review"><div><span className="audio-icon">声</span><div>
            <strong>本次访谈录音</strong><small>{(audioBlob.size / 1024 / 1024).toFixed(1)} MB</small></div></div>
            <audio controls src={URL.createObjectURL(audioBlob)} /></div>}
          <label className="transcript-editor"><span><strong>原话记录</strong><small>你可以直接补充或校正</small></span>
            <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)}
              placeholder="如果浏览器没有自动识别，可以在这里写下访谈要点。录音仍会完整保存。" />
            <button type="button" className="inline-action" onClick={() => void organizeMemory(transcript)} disabled={busy}>
              {busy ? "正在整理…" : "根据修改重新整理"}</button>
          </label>
          <label className="summary-editor"><span>本次摘要</span><textarea value={summary}
            onChange={(event) => setSummary(event.target.value)} placeholder="这次主要聊了什么？" /></label>
          <div className="review-heading"><div><span className="section-kicker">故事卡</span><h2>从这次访谈中留下</h2></div>
            <button onClick={() => setDraftStories((current) => [...current, {
              id: crypto.randomUUID(), title: "新故事", body: "", timeLabel: "时间待确认", location: "", people: "", quote: "",
            }])}>+ 添加</button></div>
          <div className="story-edit-list">{draftStories.map((story, index) => (
            <article className="story-edit-card" key={story.id}>
              <div className="story-edit-top"><input value={story.timeLabel}
                onChange={(event) => updateStory(index, { timeLabel: event.target.value })} aria-label="故事时间" />
                <button aria-label="删除故事卡" onClick={() => setDraftStories((current) =>
                  current.filter((_, storyIndex) => storyIndex !== index))}>×</button></div>
              <input className="story-title-input" value={story.title}
                onChange={(event) => updateStory(index, { title: event.target.value })} aria-label="故事标题" />
              <textarea value={story.body} onChange={(event) => updateStory(index, { body: event.target.value })}
                aria-label="故事正文" />
              <div className="story-meta-inputs"><input value={story.location}
                onChange={(event) => updateStory(index, { location: event.target.value })} placeholder="地点（待确认可留空）" />
                <input value={story.people} onChange={(event) => updateStory(index, { people: event.target.value })}
                  placeholder="涉及人物" /></div>
            </article>
          ))}</div>
          {followUps.length > 0 && <div className="next-time"><strong>下次可以继续问</strong>
            {followUps.map((item) => <p key={item}>· {item}</p>)}</div>}
          <button className="primary-button" onClick={confirmInterview} disabled={busy}>
            {busy ? "正在安全归档…" : "确认内容并归档"}</button>
          <p className="confirmation-copy">归档后，原录音与经你确认的内容会一起保存。</p>
        </section>
      )}

      {screen === "archive" && (
        <section className="page archive-page">
          <div className="page-title archive-title"><span className="section-kicker">家庭记忆档案</span>
            <h1>{elder ? `${elder.name}的生命故事` : "还没有建立档案"}</h1>
            <p>{archive.interviews.length}次访谈 · {archive.stories.length}段故事</p></div>
          <label className="search-box"><span>⌕</span><input value={search}
            onChange={(event) => setSearch(event.target.value)} placeholder="搜索时间、地点、人物或一句话" /></label>
          {selectedStory ? <article className="story-detail">
            <button onClick={() => setSelectedStory(null)}>← 返回故事列表</button>
            <span className="story-year">{selectedStory.timeLabel}</span><h2>{selectedStory.title}</h2>
            {(selectedStory.location || selectedStory.people) && <div className="story-tags">
              {selectedStory.location && <span>{selectedStory.location}</span>}
              {selectedStory.people && <span>{selectedStory.people}</span>}</div>}
            <p>{selectedStory.body}</p>{selectedStory.quote && <blockquote>“{selectedStory.quote}”</blockquote>}
            {(() => {
              const source = archive.interviews.find((item) => item.id === selectedStory.interview_id);
              if (!source) return null;
              return <div className="source-box"><span>来源：{formatDate(source.created_at)}访谈</span>
                {source.audio_key && <audio controls src={`/api/audio?key=${encodeURIComponent(source.audio_key)}`} />}</div>;
            })()}
          </article> : filteredStories.length ? <div className="timeline">
            {filteredStories.map((story) => <button key={story.id} className="timeline-story"
              onClick={() => setSelectedStory(story)}><span className="timeline-dot" /><div>
                <span>{story.timeLabel}</span><h2>{story.title}</h2><p>{story.body}</p>
                <small>{[story.location, story.people].filter(Boolean).join(" · ") || "来自访谈原始记录"}</small>
              </div></button>)}
          </div> : <div className="empty-state"><span>一页</span>
            <h2>{search ? "没有找到相关故事" : "第一段故事，等你们慢慢说"}</h2>
            <p>{search ? "试试搜索另一个时间、地点或人物。" : "完成一次访谈并确认内容后，故事会出现在这里。"}</p>
            {!search && <button className="primary-button" onClick={() => navigate(elder ? "plan" : "profile")}>开始第一次访谈</button>}
          </div>}
        </section>
      )}

      {screen === "settings" && (
        <section className="page settings-page">
          <div className="page-title"><span className="section-kicker">掌握自己的资料</span><h1>保存与隐私</h1>
            <p>家庭记忆属于家庭。你可以随时完整带走，也可以彻底删除。</p></div>
          <div className="setting-card"><span className="setting-icon">包</span><div><h2>导出完整档案</h2>
            <p>打包下载长辈资料、访谈文字、故事卡和全部录音。</p></div>
            <button onClick={exportArchive} disabled={busy || !elder}>{busy ? "处理中…" : "导出 ZIP"}</button></div>
          <div className="setting-card"><span className="setting-icon">人</span><div><h2>修改长辈档案</h2>
            <p>更新称呼、出生地、聊天习惯和不适合询问的内容。</p></div>
            <button onClick={() => { setElderDraft(elder ?? EMPTY_ELDER); navigate("profile"); }}>修改</button></div>
          <div className="setting-card danger-card"><span className="setting-icon">删</span><div><h2>删除全部资料</h2>
            <p>永久删除档案、故事和云端录音。此操作无法恢复。</p></div>
            <button onClick={deleteArchive} disabled={busy || !elder}>删除</button></div>
          <div className="principles-card"><h2>我们的记录原则</h2><p>原始录音不会被AI改写覆盖。</p>
            <p>AI整理必须经过你的确认，才会成为档案。</p><p>不确定的事实标记“待确认”，不替长辈补造经历。</p>
            <p>Agent帮助倾听，不冒充你的亲人。</p></div>
        </section>
      )}

      {screen !== "interview" && <nav className="bottom-nav" aria-label="主要功能">
        <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}><span>⌂</span>首页</button>
        <button className={screen === "plan" || screen === "review" ? "active" : ""}
          onClick={() => navigate(elder ? "plan" : "profile")}><span>●</span>访谈</button>
        <button className={screen === "archive" ? "active" : ""} onClick={() => navigate("archive")}><span>册</span>档案</button>
        <button className={screen === "settings" || screen === "profile" ? "active" : ""}
          onClick={() => navigate("settings")}><span>···</span>设置</button>
      </nav>}
    </main>
  );
}
