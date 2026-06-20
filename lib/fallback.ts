import type { AnalysisResult, Mode } from "@/lib/types";

export function getFallbackResult(mode: Mode): AnalysisResult {
  if (mode === "phone") {
    return {
      scene: mode,
      comfort: "没关系，我们只看下一步。",
      title: "先确认手机号",
      hint: "不要急着点下一步",
      explanation:
        "这个页面是在登录医保电子凭证。你先看看手机号是不是自己的，再点获取验证码。验证码只填在这个医保页面里，不要告诉别人。",
      riskLevel: "medium",
      riskReasons: ["页面涉及手机号和验证码", "需要先确认是官方医保页面"],
      careNote: "如果你记不清是怎么进入这个页面的，先不要填验证码，让家人帮你确认一下。",
      steps: [
        "先看手机号是不是自己的。",
        "点获取验证码，等短信发过来。",
        "把短信里的验证码填进去，再点下一步。"
      ],
      familyMessage:
        "我现在卡在医保电子凭证登录页面，慢慢说提示我要先确认手机号，再填写验证码。你帮我看一下这个手机号是不是对的。",
      tone: "help",
      source: "demo"
    };
  }

  if (mode === "family") {
    return {
      scene: mode,
      comfort: "你不用一次说清楚，我来帮你整理。",
      title: "已经整理好",
      hint: "家人能更快看懂",
      explanation:
        "你的问题可以说得更清楚一点：你不是不会用手机，而是卡在医保操作里，不确定下一步能不能点，需要家人帮你确认。",
      riskLevel: "low",
      riskReasons: ["当前主要是操作求助", "在家人确认前不继续操作更稳妥"],
      careNote: "你不用把每一步都记清楚。如果还有页面截图，一起发给家人就更容易帮你。",
      steps: [
        "先把整理好的话发给家人。",
        "等家人确认前，不要反复尝试。",
        "如果要输入密码或验证码，先让家人看一下。"
      ],
      familyMessage:
        "我现在卡在医保操作里，不确定下一步该不该点。慢慢说帮我整理了问题：我需要你帮我确认页面是否安全，以及下一步应该点哪里。",
      tone: "safe",
      source: "demo"
    };
  }

  return {
    scene: mode,
    comfort: "先别急，这条信息我们一起看。",
    title: "可能有风险",
    hint: "先不要点里面的链接",
    explanation:
      "它让你点击陌生链接，还可能让你输入身份证、银行卡或验证码。真正的医保通知一般不会这样让你操作。",
    riskLevel: "high",
    riskReasons: ["包含陌生网址", "用“24小时内停用”催促操作", "可能索要身份信息或验证码"],
    careNote: "如果你已经点过链接也没关系，先关闭页面。再想一下：有没有输入过身份证、银行卡或验证码？",
    steps: [
      "不要点短信里的陌生链接。",
      "不要输入身份证、银行卡或验证码。",
      "把这条信息发给家人，或拨打官方医保电话确认。"
    ],
    familyMessage:
      "我收到一条医保异常短信，慢慢说提醒可能有风险。你帮我看一下，我先不点里面的链接。",
    tone: "warn",
    source: "demo"
  };
}
