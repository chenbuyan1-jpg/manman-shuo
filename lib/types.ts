export type Mode = "phone" | "risk" | "family";
export type ResultTone = "safe" | "warn" | "help";
export type RiskLevel = "low" | "medium" | "high";

export type OfficialSource = {
  title: string;
  organization: string;
  url: string;
  reviewedAt: string;
};

export type AnalysisResult = {
  scene: Mode;
  comfort: string;
  title: string;
  hint: string;
  explanation: string;
  riskLevel: RiskLevel;
  riskReasons: string[];
  careNote: string;
  steps: string[];
  familyMessage: string;
  tone: ResultTone;
  source: "live" | "demo";
  officialSources?: OfficialSource[];
  warning?: string;
};
