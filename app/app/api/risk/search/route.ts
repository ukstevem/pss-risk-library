import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, embed, toVector } from "@/lib/server";

// POST /risk-library/api/risk/search
// body: { profile, kind?, response?, escalated?, matchCount?, minSimilarity? }
export async function POST(req: NextRequest) {
  try {
    const { profile, kind, response, escalated, matchCount, minSimilarity } = await req.json();
    if (!profile || !String(profile).trim()) {
      return NextResponse.json({ error: "profile is required" }, { status: 400 });
    }

    const { vectors } = await embed([String(profile)], "query");
    const { data, error } = await supabaseAdmin.rpc("rl_match", {
      query_embedding: toVector(vectors[0]),
      match_count: matchCount ?? 15,
      p_domain: "project",
      filter_kind: kind ?? null,
      filter_response: response ?? null,
      filter_escalated: typeof escalated === "boolean" ? escalated : null,
      min_similarity: minSimilarity ?? 0.0,
    });
    if (error) throw error;

    return NextResponse.json({ results: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
