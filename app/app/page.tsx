"use client";

import { useState } from "react";

const BP = "/risk-library";

// Relevance bands over cosine similarity (a coarse first-pass sort). The LLM triage
// below makes the real "does this apply" call. Tunable.
const STRONG = 0.66;
const POSSIBLE = 0.56;

function band(sim: number): { label: string; cls: string } {
  if (sim >= STRONG) return { label: "Strong", cls: "bg-green-100 text-green-700" };
  if (sim >= POSSIBLE) return { label: "Possible", cls: "bg-amber-100 text-amber-700" };
  return { label: "Weak", cls: "bg-gray-100 text-gray-500" };
}

type Result = {
  kind: "risk" | "issue";
  source_id: string;
  projectnumber: string | null;
  title: string | null;
  event: string | null;
  cause: string | null;
  effect: string | null;
  issue_description: string | null;
  issue_result: string | null;
  escalated: boolean | null;
  response_category: string | null;
  similarity: number;
};

type Verdict = { relevant: boolean; reason: string };

function candidateText(r: Result): string {
  if (r.kind === "risk") return [r.cause, r.event, r.effect].filter(Boolean).join(". ");
  return [r.issue_description, r.issue_result].filter(Boolean).join(". ");
}

export default function Assess() {
  const [profile, setProfile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict> | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [triageErr, setTriageErr] = useState<string | null>(null);
  const [showOther, setShowOther] = useState(false);

  async function search() {
    setLoading(true);
    setError(null);
    setResults(null);
    setVerdicts(null);
    setTriageErr(null);
    setShowOther(false);
    try {
      const res = await fetch(`${BP}/api/risk/search/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, matchCount: 20 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "search failed");
      const rows = json.results as Result[];
      setResults(rows);
      if (rows.length) triage(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "search failed");
    } finally {
      setLoading(false);
    }
  }

  async function triage(rows: Result[]) {
    setTriaging(true);
    setTriageErr(null);
    try {
      const candidates = rows.slice(0, 12).map((r) => ({ id: r.source_id, text: candidateText(r) }));
      const res = await fetch(`${BP}/api/risk/triage/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, candidates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "triage failed");
      const map: Record<string, Verdict> = {};
      for (const v of json.verdicts as { id: string; relevant: boolean; reason: string }[]) {
        map[v.id] = { relevant: v.relevant, reason: v.reason };
      }
      setVerdicts(map);
    } catch (e: unknown) {
      setTriageErr(e instanceof Error ? e.message : "triage failed");
    } finally {
      setTriaging(false);
    }
  }

  const all = results ?? [];
  const relevant = verdicts ? all.filter((r) => verdicts[r.source_id]?.relevant) : [];
  const other = verdicts ? all.filter((r) => !verdicts[r.source_id]?.relevant) : [];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Risk assessment</h1>
      <p className="text-gray-600 mb-4 text-sm">
        Describe the new job — scope, materials, methods, client, constraints. We retrieve related
        past risks/issues, then a local model judges which genuinely apply.
      </p>

      <textarea
        value={profile}
        onChange={(e) => setProfile(e.target.value)}
        rows={5}
        className="w-full border rounded p-3 text-sm"
        placeholder="e.g. Refurbish a jetty: galvanised steel in a marine environment, a new paint system, subcontracted install, delivery-critical."
      />

      <div className="mt-3">
        <button
          onClick={search}
          disabled={loading || !profile.trim()}
          className="bg-[#061b37] text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Searching…" : "Find related risks & issues"}
        </button>
      </div>

      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}

      {results && (
        <div className="mt-6 space-y-6">
          {triaging && (
            <p className="text-sm text-gray-500">Assessing which apply… <span className="text-gray-400">(local model)</span></p>
          )}

          {/* Triage available → lead with what genuinely applies */}
          {verdicts && (
            <>
              <section>
                <h2 className="font-semibold mb-3">
                  Relevant to this job <span className="text-gray-400 font-normal">({relevant.length})</span>
                </h2>
                {relevant.length === 0 ? (
                  <p className="text-gray-500 text-sm">The model judged none of the matches as genuinely relevant.</p>
                ) : (
                  <div className="space-y-3">
                    {relevant.map((r) => (
                      <ResultCard key={`${r.kind}:${r.source_id}`} r={r} reason={verdicts[r.source_id]?.reason} />
                    ))}
                  </div>
                )}
              </section>

              {other.length > 0 && (
                <div>
                  <button onClick={() => setShowOther((s) => !s)} className="text-sm text-gray-500 hover:text-gray-800">
                    {showOther ? "▾ Hide" : "▸ Show"} {other.length} other match{other.length === 1 ? "" : "es"} (judged not relevant)
                  </button>
                  {showOther && (
                    <div className="mt-3 space-y-3 opacity-70">
                      {other.map((r) => (
                        <ResultCard key={`${r.kind}:${r.source_id}`} r={r} reason={verdicts[r.source_id]?.reason} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Triage failed → fall back to similarity ranking with bands */}
          {!triaging && triageErr && (
            <section>
              <p className="text-xs text-amber-700 mb-3">Relevance model unavailable ({triageErr}) — showing similarity ranking.</p>
              <div className="space-y-3">
                {all.map((r) => (
                  <ResultCard key={`${r.kind}:${r.source_id}`} r={r} />
                ))}
              </div>
            </section>
          )}

          {all.length === 0 && <p className="text-gray-500 text-sm">No matches — the library may be empty or thin.</p>}
        </div>
      )}
    </div>
  );
}

function ResultCard({ r, reason }: { r: Result; reason?: string }) {
  const b = band(r.similarity);
  return (
    <div className="border rounded p-4 bg-white" title={`${Math.round(r.similarity * 100)}% similarity`}>
      <div className="flex items-center gap-2 mb-1 text-xs">
        <span className="bg-slate-100 text-slate-600 rounded px-2 py-0.5 capitalize">{r.kind}</span>
        <span className={`rounded px-2 py-0.5 ${b.cls}`}>{b.label}</span>
        {r.response_category && <span className="bg-gray-100 rounded px-2 py-0.5">{r.response_category}</span>}
        {r.escalated && <span className="bg-red-100 text-red-700 rounded px-2 py-0.5">escalated</span>}
        {r.projectnumber && <span className="text-gray-400">{r.projectnumber}</span>}
      </div>
      {r.kind === "risk" ? (
        <p className="text-sm">
          {r.cause && <span className="text-gray-500">Due to {r.cause}, </span>}
          <span>there is a risk that {r.event}</span>
          {r.effect && <span className="text-gray-500">, which could lead to {r.effect}</span>}.
        </p>
      ) : (
        <p className="text-sm">
          <span>{r.issue_description}</span>
          {r.issue_result && <span className="text-gray-500"> — {r.issue_result}</span>}
        </p>
      )}
      {reason && <p className="text-xs text-gray-500 mt-1.5 italic">Why: {reason}</p>}
    </div>
  );
}
