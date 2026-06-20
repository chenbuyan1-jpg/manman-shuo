import { getFallbackResult } from "@/lib/fallback";
import {
  findOfficialKnowledge,
  formatOfficialKnowledge,
  getOfficialSources
} from "@/lib/official-knowledge";
import { analyzeWithDeepSeek } from "@/lib/providers/deepseek";
import { analyzeWithMimo } from "@/lib/providers/mimo";
import { analyzeWithOpenAI } from "@/lib/providers/openai";
import type { ProviderInput } from "@/lib/analysis";
import type { AnalysisResult, Mode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mode = normalizeMode(String(formData.get("mode") || "risk"));
    const question = String(formData.get("question") || "").trim().slice(0, 1000);
    const formImage = formData.get("image");
    const image = formImage instanceof File ? formImage : null;

    if (!question && !image) {
      return Response.json({ error: "请先说一句问题，或者上传一张截图。" }, { status: 400 });
    }

    if (image) {
      if (!image.type.startsWith("image/")) {
        return Response.json({ error: "上传文件必须是图片格式。" }, { status: 400 });
      }
      if (image.size > 8 * 1024 * 1024) {
        return Response.json({ error: "图片太大，请换一张更小的截图。" }, { status: 400 });
      }
    }

    const knowledgeMatches = findOfficialKnowledge(mode, question);
    const officialSources = getOfficialSources(knowledgeMatches);
    const input: ProviderInput = {
      mode,
      question,
      image,
      officialKnowledge: formatOfficialKnowledge(knowledgeMatches)
    };
    try {
      const result = await analyzeWithPrimaryProvider(input);
      return Response.json({ result: { ...result, officialSources } });
    } catch (error) {
      console.error("Primary AI provider failed:", getErrorMessage(error));
      const backup = await tryDeepSeekFallback(input);
      if (backup) return Response.json({ result: { ...backup, officialSources } });

      return Response.json({
        result: {
          ...getFallbackResult(mode),
          officialSources,
          warning: "当前网络或模型暂时不可用，已切换为安全演示结果。"
        }
      });
    }
  } catch {
    return Response.json({ error: "这次没有看清楚，请稍后再试。" }, { status: 500 });
  }
}

async function analyzeWithPrimaryProvider(input: ProviderInput) {
  const provider = getPrimaryProvider();
  if (provider === "mimo") return analyzeWithMimo(input);
  if (provider === "openai") return analyzeWithOpenAI(input);
  throw new Error("No primary AI provider configured");
}

async function tryDeepSeekFallback(input: {
  mode: Mode;
  question: string;
  image: File | null;
  officialKnowledge: string;
}): Promise<AnalysisResult | null> {
  if (!input.question || !process.env.DEEPSEEK_API_KEY) return null;
  try {
    const result = await analyzeWithDeepSeek(input);
    return {
      ...result,
      warning: input.image
        ? "图片识别暂时不可用，以下内容只根据你输入的文字整理，请先不要进行敏感操作。"
        : "主模型暂时不可用，已切换为文字备用分析。"
    };
  } catch (error) {
    console.error("DeepSeek fallback failed:", getErrorMessage(error));
    return null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown provider error";
}

function getPrimaryProvider() {
  const configured = process.env.AI_PROVIDER?.toLowerCase();
  if (configured === "mimo" || configured === "openai" || configured === "demo") return configured;
  if (process.env.MIMO_API_KEY) return "mimo";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "demo";
}

function normalizeMode(value: string): Mode {
  if (value === "phone" || value === "family") return value;
  return "risk";
}
