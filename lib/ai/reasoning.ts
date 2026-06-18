// AI narrative reasoning — the GrowthFactor-style "why" behind the desktop
// score. We hand Claude the structured facts we already computed (score,
// per-criterion grades, competition, demographics, analogs, cannibalization)
// and ask for a grounded analyst read: a recommendation, strengths, risks, and
// a one-line take on each scored criterion.
//
// Grounding: the model is told to use ONLY the provided numbers and never invent
// data. If ANTHROPIC_API_KEY is absent the feature degrades to null (the report
// simply omits the section), exactly like the other optional data sources.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-8";

export interface ReasoningInput {
  matchedAddress: string;
  variant: string;
  scorePercent: number; // 0–1
  grade: string;
  criteria: { label: string; points: number; rating?: string }[];
  competition: { count: number; quality: string; names: string[] };
  washesByType: Record<string, number>;
  demographics: { label: string; value: string }[];
  analogs: { name: string; city: string; state: string; matchPct: number }[];
  cannibalization: { name: string; overlapPct: number }[];
}

export interface CriterionTake {
  name: string;
  assessment: string;
}
export interface Reasoning {
  recommendation: "Pursue" | "Investigate" | "Pass";
  summary: string;
  strengths: string[];
  risks: string[];
  criteria: CriterionTake[];
}

const TOOL = {
  name: "site_assessment",
  description: "Record the structured site-selection assessment.",
  input_schema: {
    type: "object",
    properties: {
      recommendation: {
        type: "string",
        enum: ["Pursue", "Investigate", "Pass"],
        description: "Overall call on this site for a ModWash express car wash.",
      },
      summary: {
        type: "string",
        description: "2–3 sentence executive read on the site.",
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "2–4 concrete strengths, each grounded in the data.",
      },
      risks: {
        type: "array",
        items: { type: "string" },
        description: "2–4 concrete risks or open questions, grounded in the data.",
      },
      criteria: {
        type: "array",
        description: "One short take per scored criterion provided.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            assessment: { type: "string" },
          },
          required: ["name", "assessment"],
        },
      },
    },
    required: ["recommendation", "summary", "strengths", "risks", "criteria"],
  },
} as const;

const SYSTEM =
  "You are a senior retail site-selection analyst evaluating locations for ModWash, " +
  "an express (exterior-only, conveyor) car wash. You assess sites the way a firm like " +
  "GrowthFactor does: tie every judgment to the numbers provided. Use ONLY the data in " +
  "the user message — never invent demographics, traffic, or competitor facts. Express " +
  "car washes want high traffic counts, strong daytime + resident population, healthy " +
  "household income, real population growth, a nearby retail traffic driver, and limited " +
  "direct express competition. Be specific and concise; cite the actual figures. Record " +
  "your assessment by calling the site_assessment tool.";

export async function generateReasoning(input: ReasoningInput): Promise<Reasoning | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "site_assessment" },
        messages: [
          {
            role: "user",
            content:
              "Assess this site from the desktop data below. Give a take on each scored " +
              "criterion, then overall strengths, risks, and a recommendation.\n\n```json\n" +
              JSON.stringify(input, null, 2) +
              "\n```",
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const block = (data?.content ?? []).find(
      (b: { type?: string }) => b.type === "tool_use",
    );
    const out = block?.input as Reasoning | undefined;
    if (!out || !out.recommendation || !Array.isArray(out.criteria)) return null;
    return out;
  } catch {
    return null;
  }
}
