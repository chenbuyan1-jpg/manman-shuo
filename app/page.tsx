"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, Mode, RiskLevel } from "@/lib/types";

type Stage = "idle" | "checking" | "done";
type FamilyStatus = "idle" | "sending" | "confirmed";
type CareAnswer = "not-clicked" | "clicked";
type SpeechState = "idle" | "listening" | "unsupported" | "error";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type Scenario = {
  sampleLabel: string;
  sampleText: string;
  defaultQuestion: string;
  comfort: string;
  resultTitle: string;
  resultHint: string;
  answer: string;
  riskLevel: RiskLevel;
  riskReasons: string[];
  careNote: string;
  advice: string[];
  familyMessage: string;
  icon: string;
  tone: "safe" | "warn" | "help";
};

type TourStep = {
  mode: Mode;
  title: string;
  narration: string;
};

const modeCopy: Record<
  Mode,
  {
    title: string;
    helper: string;
    action: string;
  }
> = {
  phone: {
    title: "我不会用手机",
    helper: "上传手机页面，慢慢说会把下一步讲成大字步骤。",
    action: "看看下一步"
  },
  risk: {
    title: "这是不是诈骗",
    helper: "上传短信、聊天或网页截图，先判断能不能点。",
    action: "慢慢看一下"
  },
  family: {
    title: "帮我跟家人说",
    helper: "说不清的问题，整理成家人一看就懂的话。",
    action: "整理给家人"
  }
};

const scenarios: Record<Mode, Scenario> = {
  phone: {
    sampleLabel: "医保电子凭证页面",
    sampleText: "医保电子凭证登录\n请输入手机号\n验证码：____\n按钮：下一步",
    defaultQuestion: "这个医保页面下一步怎么弄？",
    comfort: "没关系，我们只看下一步。",
    resultTitle: "先确认手机号",
    resultHint: "不要急着点下一步",
    answer:
      "这个页面是在登录医保电子凭证。你先看看手机号是不是自己的，再点获取验证码。验证码只填在这个医保页面里，不要告诉别人。",
    riskLevel: "medium",
    riskReasons: ["页面涉及手机号和验证码", "需要先确认是官方医保页面"],
    careNote: "如果你记不清是怎么进入这个页面的，先不要填验证码，让家人帮你确认一下。",
    advice: ["先看手机号是不是自己的。", "点获取验证码，等短信发过来。", "把短信里的验证码填进去，再点下一步。"],
    familyMessage:
      "我现在卡在医保电子凭证登录页面，慢慢说提示我要先确认手机号，再填写验证码。你帮我看一下这个手机号是不是对的。",
    icon: "?",
    tone: "help"
  },
  risk: {
    sampleLabel: "陌生短信",
    sampleText:
      "【医保通知】您的医保账户异常，请在24小时内点击 http://yb-safe.cn 完成认证，逾期将停用。",
    defaultQuestion: "这个医保短信能不能点？",
    comfort: "先别急，这条信息我们一起看。",
    resultTitle: "可能有风险",
    resultHint: "先不要点里面的链接",
    answer:
      "它让你点击陌生链接，还可能让你输入身份证、银行卡或验证码。真正的医保通知一般不会这样让你操作。",
    riskLevel: "high",
    riskReasons: ["包含陌生网址", "用“24小时内停用”催促操作", "可能索要身份信息或验证码"],
    careNote: "如果你已经点过链接也没关系，先关闭页面。再想一下：有没有输入过身份证、银行卡或验证码？",
    advice: ["不要点短信里的陌生链接。", "不要输入身份证、银行卡或验证码。", "把这条信息发给家人，或拨打官方医保电话确认。"],
    familyMessage:
      "我收到一条医保异常短信，慢慢说提醒可能有风险。你帮我看一下，我先不点里面的链接。",
    icon: "!",
    tone: "warn"
  },
  family: {
    sampleLabel: "老人原话",
    sampleText: "这个医保又弄不好了，我也不知道卡在哪一步，怕点错。",
    defaultQuestion: "帮我把这个问题说给孩子听。",
    comfort: "你不用一次说清楚，我来帮你整理。",
    resultTitle: "已经整理好",
    resultHint: "家人能更快看懂",
    answer:
      "你的问题可以说得更清楚一点：你不是不会用手机，而是卡在医保操作里，不确定下一步能不能点，需要家人帮你确认。",
    riskLevel: "low",
    riskReasons: ["当前主要是操作求助", "在家人确认前不继续操作更稳妥"],
    careNote: "你不用把每一步都记清楚。如果还有页面截图，一起发给家人就更容易帮你。",
    advice: ["先把整理好的话发给家人。", "等家人确认前，不要反复尝试。", "如果要输入密码或验证码，先让家人看一下。"],
    familyMessage:
      "我现在卡在医保操作里，不确定下一步该不该点。慢慢说帮我整理了问题：我需要你帮我确认页面是否安全，以及下一步应该点哪里。",
    icon: ">",
    tone: "safe"
  }
};

const tourSteps: TourStep[] = [
  {
    mode: "risk",
    title: "第一幕：先保护老人",
    narration: "老人收到医保异常短信，不确定能不能点。慢慢说先安抚，再提醒不要点陌生链接。"
  },
  {
    mode: "phone",
    title: "第二幕：把操作讲慢",
    narration: "老人进入医保电子凭证页面，慢慢说不一次讲完全部流程，只告诉他眼前这一步。"
  },
  {
    mode: "family",
    title: "第三幕：让求助变清楚",
    narration: "老人说不清卡在哪里，慢慢说把模糊问题整理成家人能看懂、能马上帮忙的话。"
  }
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("risk");
  const [stage, setStage] = useState<Stage>("idle");
  const [question, setQuestion] = useState("这个医保短信能不能点？");
  const [preview, setPreview] = useState("");
  const [largeText, setLargeText] = useState(true);
  const [liteMode, setLiteMode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus>("idle");
  const [careAnswer, setCareAnswer] = useState<CareAnswer | null>(null);
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [speechMessage, setSpeechMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const tourTimersRef = useRef<number[]>([]);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);

  const scenario = useMemo(() => scenarios[mode], [mode]);
  const resultView = useMemo(
    () => ({
      comfort: analysis?.comfort ?? scenario.comfort,
      resultTitle: analysis?.title ?? scenario.resultTitle,
      resultHint: analysis?.hint ?? scenario.resultHint,
      answer: analysis?.explanation ?? scenario.answer,
      riskLevel: analysis?.riskLevel ?? scenario.riskLevel,
      riskReasons: analysis?.riskReasons ?? scenario.riskReasons,
      careNote: analysis?.careNote ?? scenario.careNote,
      advice: analysis?.steps ?? scenario.advice,
      familyMessage: analysis?.familyMessage ?? scenario.familyMessage,
      tone: analysis?.tone ?? scenario.tone,
      source: analysis?.source,
      warning: analysis?.warning,
      officialSources: analysis?.officialSources ?? []
    }),
    [analysis, scenario]
  );
  const currentTourStep = tourIndex === null ? null : tourSteps[tourIndex];

  useEffect(() => {
    return () => {
      clearTourTimers();
      speechRef.current?.abort();
    };
  }, []);

  function clearTourTimers() {
    tourTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    tourTimersRef.current = [];
  }

  function stopRoadshow() {
    clearTourTimers();
    setTourIndex(null);
  }

  function selectMode(nextMode: Mode) {
    stopRoadshow();
    speechRef.current?.abort();
    setMode(nextMode);
    setQuestion(scenarios[nextMode].defaultQuestion);
    setPreview("");
    setImageFile(null);
    setAnalysis(null);
    setError("");
    setStage("idle");
    setCopied(false);
    setFamilyStatus("idle");
    setCareAnswer(null);
    setSpeechState("idle");
    setSpeechMessage("");
  }

  function scheduleTour(delay: number, callback: () => void) {
    const timer = window.setTimeout(callback, delay);
    tourTimersRef.current.push(timer);
  }

  function showTourStep(index: number, nextStage: Stage) {
    const nextMode = tourSteps[index].mode;
    setTourIndex(index);
    setMode(nextMode);
    setQuestion(scenarios[nextMode].defaultQuestion);
    setPreview("");
    setImageFile(null);
    setAnalysis(null);
    setError("");
    setCopied(false);
    setFamilyStatus("idle");
    setCareAnswer(null);
    setStage(nextStage);
  }

  function startRoadshow() {
    clearTourTimers();
    showTourStep(0, "idle");
    scheduleTour(700, () => setStage("checking"));
    scheduleTour(1650, () => setStage("done"));
    scheduleTour(3500, () => showTourStep(1, "idle"));
    scheduleTour(4200, () => setStage("checking"));
    scheduleTour(5150, () => setStage("done"));
    scheduleTour(7000, () => showTourStep(2, "idle"));
    scheduleTour(7700, () => setStage("checking"));
    scheduleTour(8650, () => setStage("done"));
    scheduleTour(9400, () => setFamilyStatus("sending"));
    scheduleTour(10200, () => setFamilyStatus("confirmed"));
    scheduleTour(11800, () => setTourIndex(null));
  }

  function handleUseSample() {
    stopRoadshow();
    setPreview("");
    setImageFile(null);
    setAnalysis(null);
    setQuestion(scenario.defaultQuestion);
    void runCheck({ file: null, question: scenario.defaultQuestion });
  }

  async function runCheck(options?: { file?: File | null; question?: string }) {
    stopRoadshow();
    setCopied(false);
    setFamilyStatus("idle");
    setCareAnswer(null);
    setError("");
    setStage("checking");

    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("question", options?.question ?? question);
    const file = options && "file" in options ? options.file : imageFile;
    if (file) formData.set("image", file);

    try {
      const [response] = await Promise.all([
        fetch("/api/analyze", { method: "POST", body: formData }),
        new Promise((resolve) => window.setTimeout(resolve, 650))
      ]);
      const payload = (await response.json()) as { result?: AnalysisResult; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "这次没有看清楚，请再试一次。");
      }
      setAnalysis(payload.result);
      setStage("done");
    } catch (reason) {
      setStage("idle");
      setError(reason instanceof Error ? reason.message : "这次没有看清楚，请再试一次。");
    }
  }

  function startVoiceQuestion() {
    stopRoadshow();
    setSpeechMessage("");

    if (speechState === "listening") {
      speechRef.current?.stop();
      return;
    }

    const browserWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechState("unsupported");
      setSpeechMessage("这台手机暂不支持语音输入，可以继续打字或上传截图。");
      return;
    }

    const recognition = new SpeechRecognition();
    let failed = false;
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      setQuestion(transcript);
      setSpeechState("idle");
      setSpeechMessage(`我听到：${transcript}`);
      void runCheck({ question: transcript });
    };
    recognition.onerror = (event) => {
      failed = true;
      setSpeechState("error");
      setSpeechMessage(
        event.error === "not-allowed"
          ? "没有拿到麦克风权限，可以继续打字或上传截图。"
          : "这次没有听清，没关系，可以再说一遍。"
      );
    };
    recognition.onend = () => {
      speechRef.current = null;
      if (!failed) setSpeechState("idle");
    };
    speechRef.current = recognition;
    setSpeechState("listening");
    setSpeechMessage("我在听，慢慢说就好。");
    recognition.start();
  }

  async function handleFileChange(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    stopRoadshow();
    setError("");
    setAnalysis(null);

    try {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      await runCheck({ file: compressed });
    } catch {
      setError("这张图片暂时无法读取，请换一张截图再试。");
      setStage("idle");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function speak() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const text = `${resultView.comfort}${resultView.resultTitle}。${resultView.answer}${resultView.advice.join("。")}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.78;
    window.speechSynthesis.speak(utterance);
  }

  async function copyFamilyMessage() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(resultView.familyMessage);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = resultView.familyMessage;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopied(true);
    } catch {
      setError("暂时不能自动复制，请长按上面的文字进行复制。");
    }
  }

  function askFamilyToConfirm() {
    if (familyStatus !== "idle") return;
    setFamilyStatus("sending");
    scheduleTour(900, () => setFamilyStatus("confirmed"));
  }

  return (
    <main className={`demo-shell ${largeText ? "large-text" : ""}`}>
      <section className="app-frame" aria-label="慢慢说产品演示">
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              慢
            </div>
            <div>
              <p className="eyebrow">AI 生活翻译器</p>
              <h1>慢慢说</h1>
              <span className="version-note">家庭共护 2.0</span>
            </div>
          </div>

          <div className="settings" aria-label="适老设置">
            <button
              className={`tour-button ${tourIndex !== null ? "active" : ""}`}
              type="button"
              onClick={tourIndex === null ? startRoadshow : stopRoadshow}
            >
              <span aria-hidden="true">{tourIndex === null ? "▶" : "■"}</span>
              {tourIndex === null ? "路演模式" : "停止路演"}
            </button>
            <label className="switch">
              <input
                type="checkbox"
                checked={largeText}
                onChange={(event) => setLargeText(event.target.checked)}
              />
              <span>大字</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={liteMode}
                onChange={(event) => setLiteMode(event.target.checked)}
              />
              <span>省流量</span>
            </label>
          </div>
        </header>

        <section className="workbench">
          <aside className="left-pane" aria-label="选择问题">
            <div className="human-note">
              <p>别着急，我们一步一步慢慢看。</p>
              <span>不乱点，不输入验证码，先确认。</span>
            </div>

            <div className="mode-list" role="tablist" aria-label="问题类型">
              {(Object.keys(modeCopy) as Mode[]).map((item) => (
                <button
                  key={item}
                  className={`mode-button ${mode === item ? "active" : ""}`}
                  type="button"
                  onClick={() => selectMode(item)}
                >
                  <span className="mode-icon" aria-hidden="true">
                    {item === "phone" ? "?" : item === "risk" ? "!" : ">"}
                  </span>
                  <strong>{modeCopy[item].title}</strong>
                  <small>{modeCopy[item].helper}</small>
                </button>
              ))}
            </div>

            <div className="input-area">
              <label htmlFor="question">你遇到什么问题？</label>
              <textarea
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="比如：这个短信能不能点？"
              />

              <div className="voice-row">
                <button
                  className={`voice-action ${speechState === "listening" ? "active" : ""}`}
                  type="button"
                  disabled={stage === "checking"}
                  onClick={startVoiceQuestion}
                >
                  <span aria-hidden="true">((</span>
                  {speechState === "listening" ? "说完了" : "说给我听"}
                </button>
                <span className="voice-status" role="status">
                  {speechMessage || "点一下，说完后自动帮你分析。"}
                </span>
              </div>

              <div className="upload-row">
                <button
                  className="secondary-action"
                  type="button"
                  disabled={stage === "checking"}
                  onClick={() => fileRef.current?.click()}
                >
                  <span aria-hidden="true">+</span>
                  拍照 / 选截图
                </button>
                <input
                  ref={fileRef}
                  className="hidden-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleFileChange(event.target.files?.[0])}
                />
                <button
                  className="text-action"
                  type="button"
                  disabled={stage === "checking"}
                  onClick={handleUseSample}
                >
                  用这个示例
                </button>
              </div>

              <button
                className="primary-action"
                type="button"
                disabled={stage === "checking"}
                onClick={() => void runCheck()}
              >
                {stage === "checking" ? "正在看..." : modeCopy[mode].action}
              </button>
              <p className="privacy-note">
                图片只用于本次分析；语音由浏览器识别，本产品不保存录音。
              </p>
              {error && <p className="inline-error" role="alert">{error}</p>}
            </div>
          </aside>

          <section className="center-pane" aria-live="polite">
            <div className="phone-view" data-lite={liteMode ? "true" : "false"}>
              <div className="phone-status">
                <span>9:41</span>
                <span>4G  62%</span>
              </div>

              <div className="phone-content">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="preview-image" src={preview} alt="上传截图预览" />
                ) : (
                  <div className="sms-sample">
                    <span className="sms-sender">{scenario.sampleLabel}</span>
                    <p>{scenario.sampleText}</p>
                  </div>
                )}

                {stage === "idle" && (
                  <div className="empty-result">
                    <strong>先把问题放进来</strong>
                    <span>可以上传截图，也可以直接用示例短信体验。</span>
                  </div>
                )}

                {stage === "checking" && (
                  <div className="checking-result">
                    <span className="loader" aria-hidden="true" />
                    <strong>正在慢慢看，不要着急</strong>
                    <span>旧手机或网络慢也可以等一等。</span>
                  </div>
                )}

                {stage === "done" && (
                  <div className="result-block" data-tone={resultView.tone}>
                    <div className="result-meta">
                      <p className="comfort">{resultView.comfort}</p>
                      {resultView.source && (
                        <span className={`source-badge ${resultView.source}`}>
                          {resultView.source === "live" ? "AI 已分析" : "安全演示"}
                        </span>
                      )}
                    </div>
                    <div className="result-summary">
                      <span aria-hidden="true">{scenario.icon}</span>
                      <div>
                        <strong>{resultView.resultTitle}</strong>
                        <small>{resultView.resultHint}</small>
                      </div>
                    </div>
                    <p className="plain-answer">{resultView.answer}</p>
                    <section className="risk-evidence" data-level={resultView.riskLevel}>
                      <div className="risk-heading">
                        <span>{riskLevelLabel(resultView.riskLevel)}</span>
                        <strong>我是这样判断的</strong>
                      </div>
                      <ul>
                        {resultView.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </section>
                    <section className="care-ahead">
                      <strong>再替你多想一步</strong>
                      <p>{resultView.careNote}</p>
                      {mode === "risk" && !careAnswer && (
                        <div className="care-question">
                          <span>刚才有没有点过这个链接？</span>
                          <div>
                            <button type="button" onClick={() => setCareAnswer("not-clicked")}>还没有</button>
                            <button type="button" onClick={() => setCareAnswer("clicked")}>已经点过</button>
                          </div>
                        </div>
                      )}
                      {careAnswer && (
                        <p className="care-response" role="status">
                          {careAnswer === "not-clicked"
                            ? "做得很稳妥。先保留截图，等家人或官方确认后再处理。"
                            : "没关系，先关闭页面。如果输入过验证码或银行卡信息，请马上联系家人和银行。"}
                        </p>
                      )}
                    </section>
                    {resultView.warning && <p className="result-warning">{resultView.warning}</p>}
                    <button className="speak-button" type="button" onClick={speak}>
                      <span aria-hidden="true">))</span>
                      读给我听
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="right-pane" aria-label="下一步和家属消息">
            {currentTourStep && (
              <section className="tour-card">
                <span>路演中</span>
                <h2>{currentTourStep.title}</h2>
                <p>{currentTourStep.narration}</p>
              </section>
            )}

            <section className="next-steps">
              <div className="section-title">
                <span aria-hidden="true">1</span>
                <h2>现在怎么做</h2>
              </div>
              <ol>
                {resultView.advice.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>

            {stage === "done" && resultView.officialSources.length > 0 && (
              <section className="official-sources">
                <div className="section-title">
                  <span aria-hidden="true">官</span>
                  <h2>官方依据</h2>
                </div>
                <p>我参考了这些官方信息，你可以和家人一起再确认。</p>
                <ul>
                  {resultView.officialSources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        <strong>{source.organization}</strong>
                        <span>{source.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <small>知识条目最后核对：{resultView.officialSources[0]?.reviewedAt}</small>
              </section>
            )}

            <section className="family-card">
              <div className="section-title">
                <span aria-hidden="true">2</span>
                <h2>家庭共护</h2>
              </div>
              <small className="family-demo-label">家属协作演示</small>
              <p>{resultView.familyMessage}</p>
              {familyStatus === "confirmed" && (
                <div className="family-reply" role="status">
                  <span>家人已回复</span>
                  <strong>先不要操作，我来帮你确认。</strong>
                </div>
              )}
              <button
                className="family-confirm-button"
                type="button"
                disabled={familyStatus !== "idle"}
                onClick={askFamilyToConfirm}
              >
                {familyStatus === "idle" && "请家人确认"}
                {familyStatus === "sending" && "正在通知家人…"}
                {familyStatus === "confirmed" && "家人已确认"}
              </button>
              <button className="copy-button" type="button" onClick={copyFamilyMessage}>
                <span aria-hidden="true">{copied ? "✓" : "[]"}</span>
                {copied ? "已复制" : "复制这句话"}
              </button>
            </section>

            <section className="fit-note">
              <h2>旧手机适配</h2>
              <ul>
                <li>轻量 H5，不强制安装 App</li>
                <li>图片先压缩，再上传分析</li>
                <li>一屏只做一件事，大按钮高对比</li>
                <li>云端识别，手机端少计算</li>
              </ul>
            </section>

            <section className="safety-note">
              <strong>重要提醒</strong>
              <p>慢慢说提供辅助判断，不替代医保、银行、公安等官方结论。涉及转账、密码和验证码时，请先暂停并联系家人或官方渠道。</p>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

async function compressImage(file: File) {
  const image = await loadImage(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error("Image compression failed");
  return new File([blob], "screen.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    image.src = url;
  });
}

function riskLevelLabel(level: RiskLevel) {
  if (level === "high") return "高风险";
  if (level === "medium") return "需确认";
  return "暂未发现风险";
}
