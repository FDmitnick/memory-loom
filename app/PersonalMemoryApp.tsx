"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { strToU8, zipSync } from "fflate";
import MemoryApp from "./MemoryApp";
import {
  convertChinese,
  toSimplified,
  type ChineseScript,
} from "@/lib/chinese";

type PersonalScreen = "home" | "capture" | "review" | "library" | "detail" | "settings";
type Category = "全部" | "过去记忆" | "生活感悟" | "当下日常" | "人物片段" | "灵感想法";
type CaptureMode = "voice" | "text";
type Viewer = { id: string; email: string; name: string; role: string };
type MemoryRow = {
  id: string;
  title: string;
  original_text: string;
  summary: string;
  category: Exclude<Category, "全部">;
  tags_json: string;
  occurred_at: string;
  people: string;
  place: string;
  mood: string;
  audio_key: string;
  audio_type: string;
  created_at: string;
  updated_at: string;
};
type MemoryEntry = {
  id: string;
  title: string;
  originalText: string;
  summary: string;
  category: Exclude<Category, "全部">;
  tags: string[];
  occurredAt: string;
  people: string;
  place: string;
  mood: string;
  audioKey: string;
  audioType: string;
  createdAt: string;
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

const CATEGORIES: Category[] = [
  "全部",
  "过去记忆",
  "生活感悟",
  "当下日常",
  "人物片段",
  "灵感想法",
];
const CATEGORY_GLYPHS: Record<Exclude<Category, "全部">, string> = {
  "过去记忆": "忆",
  "生活感悟": "悟",
  "当下日常": "今",
  "人物片段": "人",
  "灵感想法": "想",
};
const EMPTY_DRAFT: MemoryEntry = {
  id: "",
  title: "",
  originalText: "",
  summary: "",
  category: "当下日常",
  tags: [],
  occurredAt: "",
  people: "",
  place: "",
  mood: "",
  audioKey: "",
  audioType: "",
  createdAt: "",
};
const LOCALIZED_PROPS = ["placeholder", "aria-label", "title", "alt"] as const;

function localizeNode(node: ReactNode, script: ChineseScript): ReactNode {
  if (typeof node === "string") return convertChinese(node, script);
  if (Array.isArray(node)) return node.map((child) => localizeNode(child, script));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props["data-no-script"] === true) return element;
  const nextProps: Record<string, unknown> = {};
  if ("children" in element.props) {
    nextProps.children = localizeNode(element.props.children as ReactNode, script);
  }
  for (const prop of LOCALIZED_PROPS) {
    if (typeof element.props[prop] === "string") {
      nextProps[prop] = convertChinese(element.props[prop], script);
    }
  }
  if (
    (element.type === "input" ||
      element.type === "textarea") &&
    typeof element.props.value === "string"
  ) {
    nextProps.value = convertChinese(element.props.value, script);
  }
  return cloneElement(element, nextProps);
}

function readEntry(row: MemoryRow): MemoryEntry {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags_json);
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: toSimplified(row.title),
    originalText: toSimplified(row.original_text),
    summary: toSimplified(row.summary),
    category: toSimplified(row.category) as MemoryEntry["category"],
    tags: tags.map(toSimplified),
    occurredAt: toSimplified(row.occurred_at),
    people: toSimplified(row.people),
    place: toSimplified(row.place),
    mood: toSimplified(row.mood),
    audioKey: row.audio_key,
    audioType: row.audio_type,
    createdAt: row.created_at,
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

export default function PersonalMemoryApp() {
  const [screen, setScreen] = useState<PersonalScreen>("home");
  const [script, setScript] = useState<ChineseScript>("simplified");
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("voice");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [draft, setDraft] = useState<MemoryEntry>(EMPTY_DRAFT);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("全部");
  const [selected, setSelected] = useState<MemoryEntry | null>(null);
  const [interviewMode, setInterviewMode] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const keepRecognizingRef = useRef(false);

  const loadMemories = useCallback(async () => {
    try {
      const response = await fetch("/api/memories", { cache: "no-store" });
      const data = (await response.json()) as {
        entries?: MemoryRow[];
        viewer?: Viewer;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "读取失败");
      setEntries((data.entries ?? []).map(readEntry));
      setViewer(data.viewer ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "个人记录读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadMemories());
  }, [loadMemories]);
  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem("memory-loom-chinese-script");
      if (saved === "simplified" || saved === "traditional") setScript(saved);
      setScriptLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (scriptLoaded) {
      window.localStorage.setItem("memory-loom-chinese-script", script);
    }
  }, [script, scriptLoaded]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recognitionRef.current?.stop();
  }, []);

  const filteredEntries = useMemo(() => {
    const keyword = toSimplified(search.trim()).toLowerCase();
    return entries.filter((entry) => {
      if (category !== "全部" && entry.category !== category) return false;
      if (!keyword) return true;
      return [
        entry.title,
        entry.summary,
        entry.originalText,
        entry.people,
        entry.place,
        ...entry.tags,
      ].join(" ").toLowerCase().includes(keyword);
    });
  }, [category, entries, search]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function navigate(next: PersonalScreen) {
    if (recording) return;
    setError("");
    setSelected(null);
    setScreen(next);
  }

  function beginCapture(mode: CaptureMode, starter = "") {
    setCaptureMode(mode);
    setTranscript(starter);
    transcriptRef.current = starter;
    setInterimTranscript("");
    setAudioBlob(null);
    setElapsed(0);
    setDraft(EMPTY_DRAFT);
    setScreen("capture");
    setError("");
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        recorder.stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.start(1000);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);

      const speechWindow = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const SpeechRecognition =
        speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError("录音会正常保存；当前浏览器不支持实时转写，可以录完后手动补充文字。");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += toSimplified(result[0].transcript);
          else interimText += result[0].transcript;
        }
        if (finalText) {
          setTranscript((current) => {
            const next = `${current}${current && !current.endsWith("\n") ? " " : ""}${finalText}`;
            transcriptRef.current = next;
            return next;
          });
        }
        setInterimTranscript(interimText);
      };
      recognition.onend = () => {
        if (keepRecognizingRef.current) {
          try { recognition.start(); } catch { /* browser is restarting */ }
        }
      };
      recognition.onerror = () => setInterimTranscript("");
      recognitionRef.current = recognition;
      keepRecognizingRef.current = true;
      recognition.start();
    } catch {
      setError("无法使用麦克风，请允许浏览器访问麦克风后重试。");
    }
  }

  function stopRecording() {
    keepRecognizingRef.current = false;
    recognitionRef.current?.stop();
    setInterimTranscript("");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function organizePersonalMemory() {
    const originalText = toSimplified(transcript.trim());
    if (!originalText) {
      setError("请先说一段话，或者输入一些文字。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "personal-organize",
          transcript: originalText,
        }),
      });
      const result = (await response.json()) as Partial<MemoryEntry> & {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "整理失败");
      setDraft({
        ...EMPTY_DRAFT,
        id: crypto.randomUUID(),
        originalText,
        title: result.title || "今天留下的一段话",
        summary: result.summary || originalText,
        category: result.category || "当下日常",
        tags: Array.isArray(result.tags) ? result.tags : [],
        occurredAt: result.occurredAt || "",
        people: result.people || "",
        place: result.place || "",
        mood: result.mood || "",
      });
      setScreen("review");
    } catch (organizeError) {
      setError(organizeError instanceof Error ? organizeError.message : "整理失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveMemory() {
    setBusy(true);
    setError("");
    try {
      let audioKey = draft.audioKey;
      let audioType = draft.audioType;
      if (audioBlob && !audioKey) {
        const form = new FormData();
        form.set("audio", audioBlob, `${draft.id}.webm`);
        form.set("interviewId", draft.id);
        form.set("recordType", "memory");
        const audioResponse = await fetch("/api/audio", {
          method: "POST",
          body: form,
        });
        const audioResult = (await audioResponse.json()) as {
          audioKey?: string;
          audioType?: string;
          error?: string;
        };
        if (!audioResponse.ok) {
          throw new Error(audioResult.error || "录音保存失败");
        }
        audioKey = audioResult.audioKey || "";
        audioType = audioResult.audioType || "";
      }
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entry: { ...draft, audioKey, audioType },
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      await loadMemories();
      setAudioBlob(null);
      setTranscript("");
      setDraft(EMPTY_DRAFT);
      setScreen("home");
      flash("这段话已经放进你的记忆库");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  function openEntry(entry: MemoryEntry) {
    setSelected(entry);
    setScreen("detail");
  }

  function editEntry(entry: MemoryEntry) {
    setDraft(entry);
    setTranscript(entry.originalText);
    setAudioBlob(null);
    setScreen("review");
  }

  async function deleteEntry(entry: MemoryEntry) {
    if (!window.confirm(`确定删除“${entry.title}”吗？原录音也会一并删除。`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/memories?id=${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "删除失败");
      await loadMemories();
      setSelected(null);
      setScreen("library");
      flash("记录已删除");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function exportPersonalArchive() {
    setBusy(true);
    setError("");
    try {
      const files: Record<string, Uint8Array> = {
        "我的记忆档案.json": strToU8(JSON.stringify({
          exportedAt: new Date().toISOString(),
          entries,
        }, null, 2)),
      };
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (!entry.audioKey) continue;
        const response = await fetch(`/api/audio?key=${encodeURIComponent(entry.audioKey)}`);
        if (!response.ok) continue;
        files[`录音/${String(index + 1).padStart(2, "0")}-${entry.title}.webm`] =
          new Uint8Array(await response.arrayBuffer());
      }
      const zipped = zipSync(files, { level: 0 });
      downloadBlob(
        new Blob([zipped as BlobPart], { type: "application/zip" }),
        "我的岁月留声档案.zip",
      );
      flash("个人记忆档案已导出");
    } catch {
      setError("导出失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (interviewMode) {
    return <MemoryApp onExit={() => setInterviewMode(false)} />;
  }

  if (loading) {
    return <main className="app-shell loading-screen">
      <div className="memory-mark">忆</div><p>正在打开你的私人记忆空间……</p>
    </main>;
  }

  const content = (
    <main className="app-shell personal-app" lang={script === "traditional" ? "zh-TW" : "zh-CN"}>
      <header className="topbar personal-topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label="回到首页">
          <span className="brand-mark">忆</span><span>岁月留声</span>
        </button>
        <div className="topbar-actions">
          <div className="script-switch" role="group" aria-label="中文字体" data-no-script={true}>
            <button className={script === "simplified" ? "active" : ""}
              onClick={() => setScript("simplified")} aria-pressed={script === "simplified"}>简体</button>
            <button className={script === "traditional" ? "active" : ""}
              onClick={() => setScript("traditional")} aria-pressed={script === "traditional"}>繁體</button>
          </div>
          <button className="personal-account-chip" onClick={() => navigate("settings")}>
            <span>{viewer?.name?.slice(0, 1) || "我"}</span>
            <small>私人空间</small>
          </button>
        </div>
      </header>

      {notice && <div className="toast success-toast">{notice}</div>}
      {error && <div className="toast error-toast" role="alert">{error}
        <button onClick={() => setError("")}>×</button></div>}

      {screen === "home" && <section className="page personal-home">
        <div className="personal-hero">
          <span className="eyebrow">只属于你的私人记忆空间</span>
          <h1>此刻，你想<br />留下什么？</h1>
          <p>不必先想好分类。说一段过去、一点感悟，或者今天发生的小事，我会帮你整理好。</p>
          <div className="capture-actions">
            <button className="voice-start-button" onClick={() => beginCapture("voice")}>
              <span><i /></span><strong>开始说话</strong><small>录音与原话都会保存</small>
            </button>
            <button className="text-start-button" onClick={() => beginCapture("text")}>
              <span>写</span><strong>用文字记录</strong>
            </button>
          </div>
        </div>

        <div className="prompt-strip">
          <span>不知道从哪开始？</span>
          <div>
            {["刚刚想到的一件事", "小时候的一段画面", "今天明白的一个道理"].map((prompt) => (
              <button key={prompt} onClick={() => beginCapture("text", `${prompt}：`)}>{prompt}</button>
            ))}
          </div>
        </div>

        <div className="memory-overview">
          <button onClick={() => { setCategory("过去记忆"); navigate("library"); }}>
            <span>忆</span><strong>{entries.filter((entry) => entry.category === "过去记忆").length}</strong>
            <small>过去记忆</small></button>
          <button onClick={() => { setCategory("生活感悟"); navigate("library"); }}>
            <span>悟</span><strong>{entries.filter((entry) => entry.category === "生活感悟").length}</strong>
            <small>生活感悟</small></button>
          <button onClick={() => { setCategory("全部"); navigate("library"); }}>
            <span>册</span><strong>{entries.length}</strong><small>全部记录</small></button>
        </div>

        <div className="personal-recent">
          <div className="section-heading"><div><span className="section-kicker">最近留下的</span>
            <h2>我的片段</h2></div><button onClick={() => navigate("library")}>查看全部</button></div>
          {entries.length ? <div className="personal-entry-list">{entries.slice(0, 3).map((entry) => (
            <button className="personal-entry-card" key={entry.id} onClick={() => openEntry(entry)}>
              <span className="entry-glyph">{CATEGORY_GLYPHS[entry.category]}</span>
              <div><span>{entry.category} · {formatDate(entry.createdAt)}</span>
                <h3>{entry.title}</h3><p>{entry.summary}</p></div><i>›</i>
            </button>
          ))}</div> : <div className="personal-empty">
            <span>第一页</span><h3>你的第一段话，正在等你</h3>
            <p>不用完整，也不用深刻。想到什么，就从什么开始。</p>
          </div>}
        </div>

        <button className="interview-mode-card" onClick={() => setInterviewMode(true)}>
          <span>访</span><div><strong>想专门记录一位长辈？</strong>
            <p>进入长辈采访模式，生成问题并保存完整口述史。</p></div><i>›</i>
        </button>
      </section>}

      {screen === "capture" && <section className="page personal-capture-page">
        <button className="back-button" onClick={() => navigate("home")}>← 暂不记录</button>
        <div className="page-title"><span className="section-kicker">不用组织好再开口</span>
          <h1>想到什么，就说什么</h1><p>分类和摘要交给整理过程，你只需要忠于此刻的自己。</p></div>
        <div className="capture-mode-switch">
          <button className={captureMode === "voice" ? "active" : ""} onClick={() => setCaptureMode("voice")}>说话</button>
          <button className={captureMode === "text" ? "active" : ""} onClick={() => setCaptureMode("text")}>文字</button>
        </div>

        {captureMode === "voice" && <div className="personal-recorder">
          <span className={recording ? "recording-state active" : "recording-state"}>
            <i />{recording ? `正在记录 ${formatTimer(elapsed)}` : audioBlob ? "录音已完成" : "准备好了就开始"}
          </span>
          <button className={recording ? "personal-record-button stop" : "personal-record-button"}
            onClick={recording ? stopRecording : startRecording}>
            <span>{recording ? "停" : "说"}</span>
          </button>
          <p>{recording ? "轻触停止，原始声音会完整保留" : audioBlob ? "可以试听、补充文字，再交给AI整理" : "轻触开始录音"}</p>
          {audioBlob && <audio controls src={URL.createObjectURL(audioBlob)} />}
        </div>}

        <label className="personal-transcript-box">
          <span>{captureMode === "voice" ? "实时文字草稿" : "写下此刻想说的"}</span>
          <textarea value={transcript}
            onChange={(event) => setTranscript(toSimplified(event.target.value))}
            placeholder={captureMode === "voice"
              ? "说话时会尽量生成文字；也可以在这里手动补充或修改。"
              : "一件往事、一个人、今天的心情，或者突然明白的道理……"} />
          {interimTranscript && <small>{interimTranscript}</small>}
        </label>
        <div className="personal-privacy-line"><span>锁</span>
          <p>这是你的私人草稿。只有保存后才会进入记忆库，整理不会改写原始录音。</p></div>
        <button className="primary-button" disabled={busy || recording || !transcript.trim()}
          onClick={organizePersonalMemory}>{busy ? "正在理解这段话…" : "让 AI 帮我整理"}</button>
      </section>}

      {screen === "review" && <section className="page personal-review-page">
        <button className="back-button" onClick={() => setScreen("capture")}>← 返回原稿</button>
        <div className="page-title"><span className="section-kicker">整理建议 · 由你确认</span>
          <h1>我这样理解这段话</h1><p>标题、分类和摘要都可以修改。原话始终单独保留。</p></div>
        <div className="personal-review-card">
          <label className="review-category">这更像是<select value={draft.category}
            onChange={(event) => setDraft({
              ...draft,
              category: event.target.value as MemoryEntry["category"],
            })}>{CATEGORIES.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>标题<input value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>整理后的摘要<textarea value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
          <div className="personal-meta-grid">
            <label>时间<input value={draft.occurredAt} placeholder="例如：小时候、2018年"
              onChange={(event) => setDraft({ ...draft, occurredAt: event.target.value })} /></label>
            <label>人物<input value={draft.people} placeholder="原话中提到的人"
              onChange={(event) => setDraft({ ...draft, people: event.target.value })} /></label>
            <label>地点<input value={draft.place} placeholder="原话中提到的地方"
              onChange={(event) => setDraft({ ...draft, place: event.target.value })} /></label>
            <label>感受<input value={draft.mood} placeholder="例如：怀念、释然"
              onChange={(event) => setDraft({ ...draft, mood: event.target.value })} /></label>
          </div>
          <label>标签<input value={draft.tags.join("、")} placeholder="用顿号分开"
            onChange={(event) => setDraft({
              ...draft,
              tags: event.target.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
            })} /></label>
        </div>
        <label className="original-words-card"><span>我的原话</span>
          <textarea value={draft.originalText}
            onChange={(event) => setDraft({ ...draft, originalText: event.target.value })} /></label>
        {(audioBlob || draft.audioKey) && <div className="personal-audio-card"><span>声</span>
          <div><strong>原始录音</strong><small>不会被AI覆盖或改写</small></div>
          <audio controls src={audioBlob ? URL.createObjectURL(audioBlob) : `/api/audio?key=${encodeURIComponent(draft.audioKey)}`} />
        </div>}
        <button className="primary-button" disabled={busy} onClick={saveMemory}>
          {busy ? "正在放进记忆库…" : "确认并保存"}</button>
      </section>}

      {screen === "library" && <section className="page personal-library">
        <div className="page-title"><span className="section-kicker">你的第二记忆</span>
          <h1>我的记忆库</h1><p>过去的画面、今天的感受和突然出现的想法，都在这里。</p></div>
        <label className="search-box"><span>⌕</span><input value={search}
          onChange={(event) => setSearch(event.target.value)} placeholder="搜索一句话、一个人或一个地方" /></label>
        <div className="category-tabs">{CATEGORIES.map((item) => (
          <button key={item} className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}>{item}</button>
        ))}</div>
        {filteredEntries.length ? <div className="library-grid">{filteredEntries.map((entry) => (
          <button key={entry.id} className="library-memory-card" onClick={() => openEntry(entry)}>
            <div><span className="entry-glyph">{CATEGORY_GLYPHS[entry.category]}</span>
              <small>{entry.category}</small></div>
            <span>{entry.occurredAt || formatDate(entry.createdAt)}</span>
            <h2>{entry.title}</h2><p>{entry.summary}</p>
            <footer>{entry.tags.slice(0, 3).map((tag) => <i key={tag}>#{tag}</i>)}</footer>
          </button>
        ))}</div> : <div className="personal-empty"><span>空</span>
          <h3>{search ? "没有找到相关内容" : "这一类还没有记录"}</h3>
          <p>{search ? "试试另一个关键词。" : "新的记录会由AI建议分类，也可以由你调整。"}</p></div>}
      </section>}

      {screen === "detail" && selected && <section className="page personal-detail">
        <button className="back-button" onClick={() => navigate("library")}>← 返回记忆库</button>
        <article>
          <div className="detail-meta"><span>{selected.category}</span>
            <time>{selected.occurredAt || formatDate(selected.createdAt)}</time></div>
          <h1>{selected.title}</h1>
          <p className="detail-summary">{selected.summary}</p>
          {(selected.people || selected.place || selected.mood) && <div className="detail-facts">
            {selected.people && <span>人物 · {selected.people}</span>}
            {selected.place && <span>地点 · {selected.place}</span>}
            {selected.mood && <span>感受 · {selected.mood}</span>}
          </div>}
          <div className="detail-original"><span>当时的原话</span><p>{selected.originalText}</p></div>
          {selected.audioKey && <div className="detail-audio"><strong>听当时的声音</strong>
            <audio controls src={`/api/audio?key=${encodeURIComponent(selected.audioKey)}`} /></div>}
          <div className="detail-tags">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </article>
        <div className="detail-actions"><button onClick={() => editEntry(selected)}>修改整理</button>
          <button className="danger-text" disabled={busy} onClick={() => deleteEntry(selected)}>删除记录</button></div>
      </section>}

      {screen === "settings" && <section className="page personal-settings">
        <div className="page-title"><span className="section-kicker">只属于你</span>
          <h1>私人空间</h1><p>这里默认只有你自己可以访问。你的原话、录音和整理内容不会自动分享给任何人。</p></div>
        <div className="personal-profile-card"><span>{viewer?.name?.slice(0, 1) || "我"}</span>
          <div><strong>{viewer?.name || "我的账号"}</strong><p>{viewer?.email}</p></div><i>仅本人</i></div>
        <div className="setting-card"><span className="setting-icon">包</span><div><h2>导出我的全部记录</h2>
          <p>打包下载文字、分类信息和所有原始录音。</p></div>
          <button disabled={busy || !entries.length} onClick={exportPersonalArchive}>{busy ? "处理中…" : "导出 ZIP"}</button></div>
        <div className="setting-card"><span className="setting-icon">访</span><div><h2>长辈采访模式</h2>
          <p>需要时再进入，不影响你的个人记忆库。</p></div>
          <button onClick={() => setInterviewMode(true)}>进入</button></div>
        <div className="principles-card"><h2>记录原则</h2>
          <p>原始录音与AI摘要始终分开保存。</p><p>AI只整理你说过的话，不补造经历和观点。</p>
          <p>任何分类和摘要都由你最终确认。</p><p>你的个人记录默认不与家庭成员共享。</p></div>
      </section>}

      {screen !== "review" && <nav className="bottom-nav personal-bottom-nav" aria-label="主要功能">
        <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}><span>⌂</span>首页</button>
        <button className={screen === "capture" ? "active" : ""} onClick={() => beginCapture("voice")}><span>●</span>记录</button>
        <button className={screen === "library" || screen === "detail" ? "active" : ""}
          onClick={() => navigate("library")}><span>册</span>记忆</button>
        <button className={screen === "settings" ? "active" : ""} onClick={() => navigate("settings")}><span>我</span>我的</button>
      </nav>}
    </main>
  );

  return localizeNode(content, script);
}
