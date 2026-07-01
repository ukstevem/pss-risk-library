import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, embed, toVector, riskEmbedText } from "@/lib/server";

// Fields editable inline in the register. Statement fields re-embed on change.
const ALLOWED = new Set([
  "title", "cause", "event", "effect", "probability", "impact", "proximity",
  "response_category", "status", "risk_owner", "missed_risk",
  "residual_probability", "residual_impact",
]);
const STATEMENT = ["cause", "event", "effect", "title"];

// POST /risk-library/api/risk/update  body: { id, patch: {field: value, ...} }
export async function POST(req: NextRequest) {
  try {
    const { id, patch } = await req.json();
    if (!id || !patch || typeof patch !== "object") {
      return NextResponse.json({ error: "id and patch required" }, { status: 400 });
    }
    const clean: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) {
      if (ALLOWED.has(k)) clean[k] = patch[k] === "" ? null : patch[k];
    }
    if (Object.keys(clean).length === 0) {
      return NextResponse.json({ error: "no editable fields in patch" }, { status: 400 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("rl_risk")
      .update(clean)
      .eq("id", id)
      .select("id, title, cause, event, effect")
      .single();
    if (error || !updated) throw error ?? new Error("update failed");

    // If the risk statement changed, re-embed so search stays in sync.
    if (STATEMENT.some((k) => k in clean)) {
      const text = riskEmbedText(updated as { title?: string; cause?: string; event: string; effect?: string });
      const e = await embed([text], "document");
      await supabaseAdmin.from("rl_vector").upsert(
        {
          kind: "risk",
          source_id: id,
          domain: "project",
          embedded_text: text,
          embedding: toVector(e.vectors[0]),
          embedding_model: e.model,
          embedding_version: e.version,
          embedding_dim: e.dim,
          embedded_at: new Date().toISOString(),
        },
        { onConflict: "kind,source_id" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
