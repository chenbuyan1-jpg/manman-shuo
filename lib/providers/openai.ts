import {
  buildSystemPrompt,
  buildUserPrompt,
  extractJson,
  imageToDataUrl,
  normalizeResult,
  type ProviderInput
} from "@/lib/analysis";

export async function analyzeWithOpenAI(input: ProviderInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured");

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildUserPrompt(input.mode, input.question, true, input.officialKnowledge)
    }
  ];

  if (input.image) {
    content.push({ type: "input_image", image_url: await imageToDataUrl(input.image) });
  }

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: buildSystemPrompt(),
      input: [{ role: "user", content }],
      temperature: 0.2,
      max_output_tokens: 1200
    }),
    signal: AbortSignal.timeout(45000)
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const payload = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeResult(extractJson(extractResponseText(payload)), input.mode, input.officialKnowledge);
}

function extractResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content as unknown[])
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }
  throw new Error("Model returned no text");
}
