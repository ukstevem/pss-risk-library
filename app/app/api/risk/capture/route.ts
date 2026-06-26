import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, embed, toVector, riskEmbedText, issueEmbedText } from "@/lib/server";

// POST /risk-library/api/risk/capture
// body: { risk: {...}, issue?: {...}, actions?: [...] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const r = body?.risk ?? {};
    if (!r.event || !String(r.event).trim()) {
      return NextResponse.json({ error: "risk.event is required" }, { status: 400 });
    }

    // 1. insert the risk
    const { data: risk, error: riskErr } = await supabaseAdmin
      .from("rl_risk")
      .insert({
        domain: "project",
        risk_type: "threat",
        projectnumber: r.projectnumber || null,
        title: r.title || null,
        cause: r.cause || null,
        event: r.event,
        effect: r.effect || null,
        probability: r.probability || null,
        impact: r.impact || null,
        proximity: r.proximity || null,
        response_category: r.response_category || null,
        status: r.status || "open",
        risk_owner: r.risk_owner || null,
        missed_risk: !!r.missed_risk,
        captured_stage: r.captured_stage || null,
      })
      .select("id")
      .single();
    if (riskErr || !risk) throw riskErr ?? new Error("risk insert failed");
    const riskId = risk.id as string;

    // 2. embed + store the risk vector
    const riskText = riskEmbedText(r);
    const re = await embed([riskText], "document");
    await supabaseAdmin.from("rl_vector").upsert(
      {
        kind: "risk",
        source_id: riskId,
        domain: "project",
        embedded_text: riskText,
        embedding: toVector(re.vectors[0]),
        embedding_model: re.model,
        embedding_version: re.version,
        embedding_dim: re.dim,
        embedded_at: new Date().toISOString(),
      },
      { onConflict: "kind,source_id" }
    );

    // 3. optional issue (a realized risk) + its vector
    let issueId: string | null = null;
    const iss = body?.issue;
    if (iss && iss.description && String(iss.description).trim()) {
      const { data: issue, error: issErr } = await supabaseAdmin
        .from("rl_issue")
        .insert({
          risk_id: riskId,
          description: iss.description,
          result: iss.result || null,
          escalated: !!iss.escalated,
          occurred_at: iss.occurred_at || null,
          raised_by: iss.raised_by || null,
          status: iss.status || "open",
        })
        .select("id")
        .single();
      if (issErr || !issue) throw issErr ?? new Error("issue insert failed");
      issueId = issue.id as string;

      const issText = issueEmbedText(iss);
      const ie = await embed([issText], "document");
      await supabaseAdmin.from("rl_vector").upsert(
        {
          kind: "issue",
          source_id: issueId,
          domain: "project",
          embedded_text: issText,
          embedding: toVector(ie.vectors[0]),
          embedding_model: ie.model,
          embedding_version: ie.version,
          embedding_dim: ie.dim,
          embedded_at: new Date().toISOString(),
        },
        { onConflict: "kind,source_id" }
      );
    }

    // 4. optional actions (risk- or issue-phase)
    const actions = Array.isArray(body?.actions) ? body.actions : [];
    for (const a of actions) {
      if (!a?.action_text || !String(a.action_text).trim()) continue;
      await supabaseAdmin.from("rl_action").insert({
        risk_id: riskId,
        issue_id: a.phase === "issue_mitigation" ? issueId : null,
        phase: a.phase === "issue_mitigation" ? "issue_mitigation" : "risk_mitigation",
        response_type: a.response_type || null,
        action_text: a.action_text,
        actionee: a.actionee || null,
        action_date: a.action_date || null,
      });
    }

    return NextResponse.json({ riskId, issueId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "capture failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
