import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, embed, toVector } from "@/lib/server";

// Handover document -> formatted risk response.
// 1. LLM extracts a concise project profile from the document.
// 2. Embed the profile -> rl_match retrieves precedent risks/issues.
// 3. LLM synthesises a brief + a draft risk register grounded in the relevant ones.
const LLM_URL = process.env.LLM_URL ?? "http://127.0.0.1:11434";
const LLM_MODEL = process.env.LLM_MODEL ?? "qwen2.5:7b";

async function chat(messages: unknown[], format?: unknown): Promise<string> {
  const res = await fetch(`${LLM_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: LLM_MODEL, stream: false, options: { temperature: 0 }, ...(format ? { format } : {}), messages }),
  });
  if (!res.ok) throw new Error(`LLM returned ${res.status}`);
  const data = await res.json();
  return data.message.content as string;
}

const REGISTER_SCHEMA = {
  type: "object",
  properties: {
    brief: { type: "string" },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          likelihood: { type: "string" },
          impact: { type: "string" },
          response: { type: "string" },
          precedent: { type: "string" },
        },
        required: ["risk", "likelihood", "impact", "response", "precedent"],
      },
    },
  },
  required: ["brief", "rows"],
};

type Cand = {
  kind: string;
  cause: string | null;
  event: string | null;
  effect: string | null;
  issue_description: string | null;
  issue_result: string | null;
  response_category: string | null;
  projectnumber: string | null;
};

function candLine(c: Cand, i: number): string {
  const body =
    c.kind === "risk"
      ? [c.cause, c.event, c.effect].filter(Boolean).join(". ")
      : `${c.issue_description ?? ""}${c.issue_result ? ". Result: " + c.issue_result : ""}`;
  const resp = c.response_category ? ` (past response: ${c.response_category})` : "";
  const pj = c.projectnumber ? ` [${c.projectnumber}]` : "";
  return `${i + 1}. [${c.kind}]${pj} ${body}${resp}`;
}

// POST /risk-library/api/risk/assess-doc/  body: { document }
export async function POST(req: NextRequest) {
  try {
    const { document } = await req.json();
    if (!document || !String(document).trim()) {
      return NextResponse.json({ error: "document required" }, { status: 400 });
    }

    // 1. Extract a project profile from the handover
    const profile = (
      await chat([
        {
          role: "system",
          content:
            "Extract a concise project profile from a handover document: scope, materials, methods, location, client, and key constraints. 2-4 plain sentences, no preamble, no bullet points.",
        },
        { role: "user", content: String(document).slice(0, 12000) },
      ])
    ).trim();

    // 2. Retrieve precedents
    const { vectors } = await embed([profile], "query");
    const { data: cands, error } = await supabaseAdmin.rpc("rl_match", {
      query_embedding: toVector(vectors[0]),
      match_count: 12,
      p_domain: "project",
      min_similarity: 0.0,
    });
    if (error) throw error;
    const candidates = (cands ?? []) as Cand[];

    // 3. Synthesise brief + draft register from the relevant precedents
    const list = candidates.map(candLine).join("\n");
    const content = await chat(
      [
        {
          role: "system",
          content:
            "You are a project risk manager. Given a NEW project and past risks/issues from similar projects, produce (a) a 2-3 sentence 'brief' of the risk picture for this project, and (b) 'rows' — a draft risk register. Include a row ONLY for past items genuinely relevant to this project; ignore unrelated ones. Each row: risk (a cause->event->effect statement adapted to THIS project), likelihood and impact (low/medium/high), response (avoid/reduce/transfer/accept), and precedent (a one-line note on what the past project logged or experienced). Ground everything in the provided material; do not invent precedents.",
        },
        {
          role: "user",
          content: `New project:\n${profile}\n\nPast risks/issues (numbered):\n${list || "(none found)"}\n\nReturn JSON with 'brief' and 'rows'.`,
        },
      ],
      REGISTER_SCHEMA
    );
    const parsed = JSON.parse(content) as { brief?: string; rows?: unknown[] };

    return NextResponse.json({
      profile,
      brief: parsed.brief ?? "",
      rows: parsed.rows ?? [],
      candidateCount: candidates.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "assessment failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
