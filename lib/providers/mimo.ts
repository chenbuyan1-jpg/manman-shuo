import {
  buildSystemPrompt,
  buildUserPrompt,
  extractChatCompletionText,
  extractJson,
  imageToDataUrl,
  normalizeResult,
  type ProviderInput
} from "@/lib/analysis";

export async function analyzeWithMimo(input: ProviderInput) {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) throw new Error("MiMo API key is not configured");

  const baseUrl = (process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1").replace(/\/$/, "");
  const model = process.env.MIMO_MODEL || "mimo-v2.5";
  const content: Array<Record<string, unknown>> = [];

  if (input.image) {
    content.push({
      type: "image_url",
      image_url: { url: await imageToDataUrl(input.image) }
    });
  }
  content.push({
    type: "text",
    text: buildUserPrompt(input.mode, input.question, true, input.officialKnowledge)
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1200,
      temperature: 0.2,
      stream: false
    }),
    signal: AbortSignal.timeout(45000)
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`MiMo request failed: ${response.status}`);
  const payload = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeResult(
    extractJson(extractChatCompletionText(payload)),
    input.mode,
    input.officialKnowledge
  );
}
