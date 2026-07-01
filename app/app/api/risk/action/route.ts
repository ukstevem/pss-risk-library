import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server";

// POST /risk-library/api/risk/action/  body: { risk_id, action_text, response_type?, actionee?, phase? }
// Records "what we'll do" against a risk. Actions aren't embedded, so this is a plain insert.
export async function POST(req: NextRequest) {
  try {
    const { risk_id, action_text, response_type, actionee, phase } = await req.json();
    if (!risk_id || !action_text || !String(action_text).trim()) {
      return NextResponse.json({ error: "risk_id and action_text required" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("rl_action")
      .insert({
        risk_id,
        action_text,
        response_type: response_type || null,
        actionee: actionee || null,
        phase: phase === "issue_mitigation" ? "issue_mitigation" : "risk_mitigation",
      })
      .select("id, action_text, response_type, actionee, phase, action_date")
      .single();
    if (error || !data) throw error ?? new Error("insert failed");
    return NextResponse.json({ action: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "add action failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
