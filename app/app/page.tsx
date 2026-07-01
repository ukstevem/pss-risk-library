"use client";

import { useState } from "react";

const BP = "/risk-library";

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

export default function Assess() {
  const [profile, setProfile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BP}/api/risk/search/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, matchCount: 15 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "search failed");
      setResults(json.results as Result[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  const risks = (results ?? []).filter((r) => r.kind === "risk");
  const issues = (results ?? []).filter((r) => r.kind === "issue");

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Risk assessment</h1>
      <p className="text-gray-600 mb-4 text-sm">
        Describe the new job — scope, materials, methods, client, constraints. We surface
        semantically related past risks and issues, including ones from jobs that don&apos;t look
        similar on paper.
      </p>

      <textarea
        value={profile}
        onChange={(e) => setProfile(e.target.value)}
        rows={5}
        className="w-full border rounded p-3 text-sm"
        placeholder="e.g. Fabricate and install 120t of structural steel for an offshore module; novel duplex coating spec; tight delivery; new fabrication subcontractor."
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
        <div className="mt-6 space-y-8">
          <ResultGroup title="Risks to consider" items={risks} />
          <ResultGroup title="Issues that hit related jobs" items={issues} />
          {results.length === 0 && (
            <p className="text-gray-500 text-sm">
              No matches — the library may be empty or thin. Add records via Capture or Seed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, items }: { title: string; items: Result[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="font-semibold mb-3">
        {title} <span className="text-gray-400 font-normal">({items.length})</span>
      </h2>
      <div className="space-y-3">
        {items.map((r) => (
          <ResultCard key={`${r.kind}:${r.source_id}`} r={r} />
        ))}
      </div>
    </section>
  );
}

function ResultCard({ r }: { r: Result }) {
  const pct = Math.round((r.similarity ?? 0) * 100);
  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex items-center gap-2 mb-1 text-xs">
        <span className="bg-gray-100 rounded px-2 py-0.5">{pct}% match</span>
        {r.response_category && (
          <span className="bg-gray-100 rounded px-2 py-0.5">{r.response_category}</span>
        )}
        {r.escalated && (
          <span className="bg-red-100 text-red-700 rounded px-2 py-0.5">escalated</span>
        )}
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
    </div>
  );
}
