import { NextRequest, NextResponse } from "next/server";

// Phase-2 relevance triage: a local LLM judges which retrieved candidates genuinely
// apply to the new project — the judgment cosine similarity can't make.
const LLM_URL = process.env.LLM_URL ?? "http://127.0.0.1:11434";
const LLM_MODEL = process.env.LLM_MODEL ?? "qwen2.5:7b";

const SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          relevant: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["n", "relevant", "reason"],
      },
    },
  },
  required: ["verdicts"],
};

// POST /risk-library/api/risk/triage/  body: { profile, candidates: [{id, text}] }
export async function POST(req: NextRequest) {
  try {
    const { profile, candidates } = await req.json();
    if (!profile || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: "profile and candidates required" }, { status: 400 });
    }

    const numbered = candidates.map((c: { text: string }, i: number) => `${i + 1}. ${c.text}`).join("\n");
    const body = {
      model: LLM_MODEL,
      stream: false,
      format: SCHEMA,
      options: { temperature: 0 },
      messages: [
        {
          role: "system",
          content:
            "You are a project risk manager judging which PAST risks could plausibly occur on a NEW project, based only on its scope, materials and methods. Mark relevant=true only when the risk clearly relates to what the project actually involves.",
        },
        {
          role: "user",
          content: `New project: ${profile}\n\nPast risks (numbered):\n${numbered}\n\nReturn one verdict for EACH of the ${candidates.length} risks: its number n, relevant (true/false), and a one-line reason grounded in THIS project.`,
        },
      ],
    };

    const res = await fetch(`${LLM_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LLM returned ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.message.content) as { verdicts?: { n: number; relevant: boolean; reason: string }[] };

    const verdicts = (parsed.verdicts ?? [])
      .map((v) => ({ id: candidates[v.n - 1]?.id as string | undefined, relevant: !!v.relevant, reason: v.reason ?? "" }))
      .filter((v) => v.id);

    return NextResponse.json({ model: LLM_MODEL, verdicts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "triage failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
