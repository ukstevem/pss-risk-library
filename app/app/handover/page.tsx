"use client";

import { useState } from "react";

const BP = "/risk-library";

type Row = { risk: string; likelihood: string; impact: string; response: string; precedent: string };
type Out = { profile: string; brief: string; rows: Row[]; candidateCount: number };

export default function Handover() {
  const [doc, setDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<Out | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    setOut(null);
    try {
      const res = await fetch(`${BP}/api/risk/assess-doc/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "assessment failed");
      setOut(json as Out);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "assessment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Handover → risk assessment</h1>
      <p className="text-gray-600 mb-4 text-sm">
        Paste a project handover (or technical review). We read the project, retrieve related past
        risks, and draft a risk brief + register grounded in what happened before.
      </p>

      <textarea
        value={doc}
        onChange={(e) => setDoc(e.target.value)}
        rows={10}
        className="w-full border rounded p-3 text-sm font-mono"
        placeholder="Paste the handover / technical review text here…"
      />
      <div className="mt-3">
        <button
          onClick={generate}
          disabled={busy || !doc.trim()}
          className="bg-[#061b37] text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {busy ? "Reading → retrieving → drafting…" : "Generate risk assessment"}
        </button>
      </div>

      {err && <div className="mt-4 text-red-600 text-sm">{err}</div>}

      {out && (
        <div className="mt-6 space-y-5">
          <div className="text-xs text-gray-500 bg-gray-50 border rounded p-3">
            <span className="font-medium text-gray-600">Read from the document:</span> {out.profile}
            <span className="text-gray-400"> · {out.candidateCount} precedent{out.candidateCount === 1 ? "" : "s"} retrieved</span>
          </div>

          {out.brief && (
            <div>
              <h2 className="font-semibold mb-1">Risk brief</h2>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{out.brief}</p>
            </div>
          )}

          <div>
            <h2 className="font-semibold mb-2">
              Draft risk register <span className="text-gray-400 font-normal">({out.rows.length})</span>
            </h2>
            {out.rows.length === 0 ? (
              <p className="text-sm text-gray-500">No relevant precedents found for this project yet.</p>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium">Risk</th>
                      <th className="px-2 py-2 font-medium">L</th>
                      <th className="px-2 py-2 font-medium">I</th>
                      <th className="px-2 py-2 font-medium">Response</th>
                      <th className="px-3 py-2 font-medium">Precedent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {out.rows.map((r, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-2">{r.risk}</td>
                        <td className="px-2 py-2 capitalize whitespace-nowrap">{r.likelihood}</td>
                        <td className="px-2 py-2 capitalize whitespace-nowrap">{r.impact}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.response}</td>
                        <td className="px-3 py-2 text-gray-500 italic">{r.precedent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
