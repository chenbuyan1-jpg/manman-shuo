import { getFallbackResult } from "@/lib/fallback";
import type { AnalysisResult, Mode, ResultTone, RiskLevel } from "@/lib/types";

export type ProviderInput = {
  mode: Mode;
  question: string;
  image: File | null;
  officialKnowledge: string;
};

export function buildSystemPrompt() {
  return `你是“慢慢说”的适老化解释助手。服务对象是智能手机使用不熟练的老年人。

原则：
1. 先安抚，不责备、不嘲讽、不制造恐慌。
2. 涉及陌生链接、转账、银行卡、密码或验证码时，采取谨慎策略，明确建议先暂停并向家人或官方渠道确认。
3. 不做医疗诊断，不冒充政府、医保、银行或公安机关。
4. 每句话简短、通俗。步骤最多3条，每条只做一件事。
5. 老人的表述可能不完整、前后不一致或记不清。不要质疑和责备，先给保守建议，并主动多考虑一步。
6. careNote 要补充用户可能没有意识到的下一个问题，例如“如果已经点过也没关系，先告诉我有没有输入验证码”。
7. 不得补充官方知识中未提供的热线号码、网址或具体办事要求。不确定时只说“当地官方渠道”。
8. 不要建议老人通过搜索引擎寻找电话或办事入口，避免点到广告或假网站。
9. 只返回JSON，不要Markdown。

JSON格式：
{
  "comfort": "一句安抚",
  "title": "最多8个字的结论",
  "hint": "一句最重要的提醒",
  "explanation": "不超过100字的通俗解释",
  "riskLevel": "low或medium或high",
  "riskReasons": ["最多3条判断依据"],
  "careNote": "主动多替老人考虑一步的提醒",
  "steps": ["步骤1", "步骤2", "步骤3"],
  "familyMessage": "老人可以直接发给家人的消息",
  "tone": "safe或warn或help"
}`;
}

export function buildUserPrompt(
  mode: Mode,
  question: string,
  canSeeImage = true,
  officialKnowledge = ""
) {
  const scene =
    mode === "phone" ? "手机操作指导" : mode === "family" ? "整理给家人的求助" : "风险信息判断";
  const imageInstruction = canSeeImage
    ? "请结合截图（如有）给出谨慎、可执行的适老化说明。"
    : "你无法看到截图，只能根据老人输入的文字回答。不要声称已经识别图片；信息不足时建议暂停操作并请家人确认。";
  const knowledgeInstruction = officialKnowledge
    ? `\n\n已检索到的官方信息：\n${officialKnowledge}\n只可将这些内容作为官方依据；如果不足以支撑结论，要明确建议用户向官方渠道确认。`
    : "";
  return `当前场景：${scene}\n老人说：${question || "请根据截图判断"}\n${imageInstruction}${knowledgeInstruction}`;
}

export function normalizeResult(
  value: Record<string, unknown>,
  mode: Mode,
  officialKnowledge = ""
): AnalysisResult {
  const fallback = getFallbackResult(mode);
  const rawSteps = Array.isArray(value.steps) ? value.steps : [];
  const steps = rawSteps.map((item) => cleanStep(String(item))).filter(Boolean).slice(0, 3);
  const rawReasons = Array.isArray(value.riskReasons) ? value.riskReasons : [];
  const riskReasons = rawReasons.map(String).filter(Boolean).slice(0, 3);

  const result: AnalysisResult = {
    scene: mode,
    comfort: cleanText(value.comfort, fallback.comfort, 40),
    title: cleanText(value.title, fallback.title, 16),
    hint: cleanText(value.hint, fallback.hint, 40),
    explanation: cleanText(value.explanation, fallback.explanation, 180),
    riskLevel: normalizeRiskLevel(value.riskLevel, fallback.riskLevel),
    riskReasons: riskReasons.length ? riskReasons : fallback.riskReasons,
    careNote: cleanText(value.careNote, fallback.careNote, 120),
    steps: steps.length ? steps : fallback.steps,
    familyMessage: cleanText(value.familyMessage, fallback.familyMessage, 220),
    tone: normalizeTone(value.tone, fallback.tone),
    source: "live"
  };

  return {
    ...result,
    hint: sanitizeUnsupportedOfficialClaims(result.hint, officialKnowledge),
    explanation: sanitizeUnsupportedOfficialClaims(result.explanation, officialKnowledge),
    riskReasons: result.riskReasons.map((item) =>
      sanitizeUnsupportedOfficialClaims(item, officialKnowledge)
    ),
    careNote: sanitizeUnsupportedOfficialClaims(result.careNote, officialKnowledge),
    steps: result.steps.map((item) => sanitizeUnsupportedOfficialClaims(item, officialKnowledge)),
    familyMessage: sanitizeUnsupportedOfficialClaims(result.familyMessage, officialKnowledge)
  };
}

export function extractJson(text: string) {
  const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("Model returned invalid JSON");
  }
}

export function extractChatCompletionText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  if (!first || typeof first !== "object") throw new Error("Model returned no choices");
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") throw new Error("Model returned no message");
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Model returned no content");
  return content;
}

export async function imageToDataUrl(image: File) {
  const bytes = Buffer.from(await image.arrayBuffer());
  return `data:${image.type};base64,${bytes.toString("base64")}`;
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function cleanStep(value: string) {
  return value.trim().replace(/^\s*(?:第[一二三\d]+步[.:：、]?\s*|[1-3][.、]\s*)/, "");
}

function normalizeTone(value: unknown, fallback: ResultTone): ResultTone {
  if (value === "safe" || value === "warn" || value === "help") return value;
  return fallback;
}

function normalizeRiskLevel(value: unknown, fallback: RiskLevel): RiskLevel {
  if (value === "low" || value === "medium" || value === "high") return value;
  return fallback;
}

function sanitizeUnsupportedOfficialClaims(text: string, officialKnowledge: string) {
  return text
    .replace(/(?<!\d)\d{5}(?!\d)/g, (number) =>
      officialKnowledge.includes(number) ? number : "当地官方服务热线"
    )
    .replace(/https?:\/\/[^\s，。；]+/g, (url) =>
      officialKnowledge.includes(url) ? url : "官方网站"
    );
}
