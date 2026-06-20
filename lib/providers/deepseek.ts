import {
  buildSystemPrompt,
  buildUserPrompt,
  extractChatCompletionText,
  extractJson,
  normalizeResult,
  type ProviderInput
} from "@/lib/analysis";

export async function analyzeWithDeepSeek(input: ProviderInput) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek API key is not configured");
  if (!input.question) throw new Error("DeepSeek fallback requires text");

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildUserPrompt(input.mode, input.question, false, input.officialKnowledge)
        }
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 1200,
      temperature: 0.2,
      stream: false
    }),
    signal: AbortSignal.timeout(30000)
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const payload = JSON.parse(responseText) as Record<string, unknown>;
  return normalizeResult(
    extractJson(extractChatCompletionText(payload)),
    input.mode,
    input.officialKnowledge
  );
}
