# 慢慢说 Demo

慢慢说是一款面向老年人与异地子女的 AI 生活翻译器，把复杂的手机操作、风险信息和生活服务，翻译成老人看得懂、听得懂、敢操作的话。

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/chenbuyan1-jpg/manman-shuo)

## 本地运行

```bash
npm run dev
```

默认地址：

```text
http://127.0.0.1:4176
```

## 小米 MiMo 配置

Demo 默认使用小米 `mimo-v2.5` 分析截图和文字。打开 `.env.local`，只填写密钥：

```text
AI_PROVIDER=mimo
MIMO_API_KEY=你的密钥
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

不要把 `.env.local` 或密钥发给他人。修改后重新启动开发服务才能生效。

## 部署到 Netlify

1. 点击上方 `Deploy to Netlify`
2. 部署完成后，在 Netlify 项目的环境变量中填写：

```text
AI_PROVIDER=mimo
MIMO_API_KEY=你的密钥
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

3. 触发一次重新部署后，线上图片识别即可使用

`.env.local` 已被 Git 忽略，不会推送到 GitHub。

可选填写 `DEEPSEEK_API_KEY` 作为纯文字备用。MiMo 不可用时，DeepSeek 只根据用户输入的文字回答，不会声称已经看过截图。两个模型均不可用时，产品会自动返回标注为“安全演示”的兜底结果。上传图片会先在浏览器内压缩，服务端不做持久化保存。

## Demo 功能

- 2.0 家庭共护：风险分级、判断依据、主动追问与家属确认演示
- 语音提问：点击后直接说话，识别完自动提交分析
- 官方流程知识库：医保、反诈与政务条目检索，结果页显示来源
- 这是不是诈骗：识别医保异常短信风险
- 我不会用手机：指导医保电子凭证页面下一步
- 帮我跟家人说：把老人说不清的问题整理成家属消息
- 路演模式：自动播放三幕参赛演示故事
- 大字模式、省流量模式、语音播报、一键复制家属消息
- 多模态 AI 分析、接口失败自动兜底、隐私与风险提醒
- PWA 主屏安装、360px 窄屏与弱网体验适配

语音识别依赖当前浏览器能力。不支持时会保留打字和截图入口，不影响核心功能。

## 参赛材料

参赛提交包位于 `docs/`：

- `01-参赛报名文案.md`
- `02-路演讲稿.md`
- `03-产品功能说明.md`
- `04-技术方案.md`
- `05-提交检查清单.md`
- `06-Demo录屏脚本.md`
- `07-作品帖文案.md`
- `08-录屏口语旁白.md`
- `09-2.0迭代说明.md`

作品封面页：

- `docs/cover.html`
- `docs/慢慢说-作品封面.png`
