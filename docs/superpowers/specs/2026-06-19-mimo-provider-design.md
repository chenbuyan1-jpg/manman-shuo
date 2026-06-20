# 慢慢说 MiMo 模型接入设计

## 目标

将现有 Demo 从单一 OpenAI Responses API 调用改为可配置的模型供应商链路，使用小米 `mimo-v2.5` 完成截图和文字理解，并保留 DeepSeek 文字备用与本地安全模板。

## 范围

- 只修改服务端模型调用、环境变量示例和技术说明。
- 不调整老人端页面布局、交互路径和路演模式。
- 不在浏览器端保存或暴露任何 API Key。
- 不建设账号系统、数据库、用量后台或子女端。

## 调用架构

服务端按照以下顺序处理一次分析请求：

1. `AI_PROVIDER=mimo` 且配置 `MIMO_API_KEY` 时，调用 `https://api.xiaomimimo.com/v1/chat/completions`。
2. MiMo 使用 `mimo-v2.5`，接收用户问题和可选 Base64 图片，返回固定 JSON 结构。
3. MiMo 失败时，若存在用户文字且配置 `DEEPSEEK_API_KEY`，调用 DeepSeek 生成保守的纯文字说明，并明确不依据图片作判断。
4. 没有可用模型、只有图片但 MiMo 失败，或返回内容无法解析时，使用当前安全演示模板。

现有 OpenAI Responses API 适配保留，通过 `AI_PROVIDER=openai` 启用，避免已有能力回退。

## 配置

```text
AI_PROVIDER=mimo
MIMO_API_KEY=
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

密钥仅写入 `.env.local`。`.env.local` 必须被 Git 忽略，`.env.example` 只保留空值和配置说明。

## 数据格式

所有供应商最终统一转换为现有 `AnalysisResult`：

- 安抚语 `comfort`
- 短结论 `title`
- 关键提醒 `hint`
- 通俗解释 `explanation`
- 最多三步行动 `steps`
- 家属消息 `familyMessage`
- 结果语气 `tone`
- 来源 `source`

模型输出经过 JSON 提取、字段长度限制、枚举校验和缺失字段补齐后才返回前端。

## 安全与失败处理

- 图片只在单次请求中转为 Base64，不持久化保存。
- 涉及链接、转账、银行卡、密码和验证码时继续采用谨慎提示词。
- MiMo 请求超时设为 45 秒；失败后才尝试文字备用，不并发重复计费。
- DeepSeek 不接收图片，不能把其结果标成图片识别结论。
- 前端不展示供应商错误详情，只显示演示兜底提示。
- 服务端日志不得输出 API Key 或完整图片 Base64。

## 文件边界

- `app/api/analyze/route.ts`：请求校验、供应商编排和统一返回。
- `lib/providers/mimo.ts`：MiMo 请求与响应解析。
- `lib/providers/deepseek.ts`：DeepSeek 纯文字备用。
- `lib/providers/openai.ts`：迁移现有 Responses API 调用。
- `lib/analysis.ts`：共用提示词、JSON 提取和结果规范化。
- `.env.example`、`README.md`、`docs/04-技术方案.md`：同步配置和架构说明。

## 验证标准

1. 配置 MiMo 后，上传真实截图返回 `source=live` 和三步以内建议。
2. 纯文字问题可由 MiMo 正常处理。
3. MiMo 密钥错误时，有 DeepSeek 文字输入则进入文字备用；无文字则进入安全模板。
4. 两个密钥均未配置时，现有比赛演示仍能完成。
5. 非图片、超大图片和空输入继续被正确拦截。
6. API Key 不出现在浏览器页面、构建产物、日志和版本控制中。
7. 类型检查、生产构建和桌面/移动端核心流程全部通过。
