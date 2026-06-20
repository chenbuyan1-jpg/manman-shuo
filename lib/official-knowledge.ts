import type { Mode, OfficialSource } from "@/lib/types";

type KnowledgeEntry = {
  id: string;
  modes: Mode[];
  keywords: string[];
  title: string;
  guidance: string;
  source: OfficialSource;
};

const reviewedAt = "2026-06-19";

const entries: KnowledgeEntry[] = [
  {
    id: "health-insurance-message",
    modes: ["risk", "phone"],
    keywords: ["医保", "账户异常", "停用", "认证", "短信", "链接", "电子凭证"],
    title: "医保信息先走官方渠道核验",
    guidance:
      "收到自称医保部门、要求点击短信链接认证或补缴的信息时，先不要点击。应主动打开国家医保服务平台或当地医保部门官方渠道核验，不要在陌生页面输入身份信息、银行卡或验证码。不通过搜索广告寻找电话和入口。",
    source: {
      title: "国家医疗保障局",
      organization: "国家医疗保障局",
      url: "https://www.nhsa.gov.cn/",
      reviewedAt
    }
  },
  {
    id: "anti-fraud-stop-first",
    modes: ["risk", "family"],
    keywords: ["诈骗", "陌生链接", "验证码", "银行卡", "转账", "密码", "公安"],
    title: "涉及转账和验证码先停止操作",
    guidance:
      "陌生人索要验证码、密码、银行卡信息或要求转账时，先立即停止操作。通过银行卡背面、官方 App 或公安机关公开渠道核实；如果诈骗正在发生或已造成损失，及时拨打 110。",
    source: {
      title: "公安部",
      organization: "中华人民共和国公安部",
      url: "https://www.mps.gov.cn/",
      reviewedAt
    }
  },
  {
    id: "government-service-hotline",
    modes: ["phone", "family"],
    keywords: ["政务", "办事", "社保", "证明", "社区", "12345", "热线"],
    title: "政务咨询通过 12345 或官方平台",
    guidance:
      "对于非紧急的政务服务咨询、办事流程和求助，可通过当地 12345 政务服务便民热线或政府官方服务平台确认。不通过陌生人提供的私人联系方式办理。",
    source: {
      title: "国务院办公厅关于优化政务服务便民热线的指导意见",
      organization: "中国政府网",
      url: "https://www.gov.cn/zhengce/content/2021-01/06/content_5577419.htm",
      reviewedAt
    }
  }
];

export function findOfficialKnowledge(mode: Mode, question: string) {
  const normalized = question.toLowerCase();
  const ranked = entries
    .map((entry) => ({
      entry,
      score:
        entry.keywords.reduce((total, keyword) => total + (normalized.includes(keyword.toLowerCase()) ? 2 : 0), 0) +
        (entry.modes.includes(mode) ? 1 : 0)
    }))
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ entry }) => entry);

  if (ranked.length) return ranked;
  return entries.filter((entry) => entry.modes.includes(mode)).slice(0, 1);
}

export function formatOfficialKnowledge(matches: KnowledgeEntry[]) {
  return matches
    .map((entry, index) => `${index + 1}. ${entry.title}\n${entry.guidance}\n来源：${entry.source.organization}`)
    .join("\n\n");
}

export function getOfficialSources(matches: KnowledgeEntry[]) {
  return matches.map((entry) => entry.source);
}
