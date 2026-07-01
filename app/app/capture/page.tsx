"use client";

import { useEffect, useState } from "react";
import { supabase } from "@platform/supabase";

const BP = "/risk-library";
const RESPONSES = ["", "avoid", "reduce", "transfer", "accept", "contingency"];
const LEVELS = ["", "low", "medium", "high"];
const STATUS = ["open", "closed"];

type Risk = {
  id: string;
  cause: string | null;
  event: string;
  effect: string | null;
  probability: string | null;
  impact: string | null;
  response_category: string | null;
  residual_probability: string | null;
  residual_impact: string | null;
  risk_owner: string | null;
  status: string;
  projectnumber: string | null;
  missed_risk: boolean;
};

const SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 };

function level(prob: string | null, impact: string | null): { label: string; cls: string } | null {
  if (!prob || !impact) return null;
  const s = (SCORE[prob] ?? 0) * (SCORE[impact] ?? 0);
  if (s >= 6) return { label: "High", cls: "bg-red-100 text-red-700" };
  if (s >= 3) return { label: "Med", cls: "bg-amber-100 text-amber-700" };
  return { label: "Low", cls: "bg-green-100 text-green-700" };
}

function Score({ prob, impact }: { prob: string | null; impact: string | null }) {
  const lv = level(prob, impact);
  return lv ? <span className={`rounded px-2 py-0.5 text-xs ${lv.cls}`}>{lv.label}</span> : <span className="text-gray-300 text-xs">—</span>;
}

const EMPTY_NEW = { event: "", cause: "", effect: "", probability: "", impact: "", response_category: "", risk_owner: "" };

export default function Register() {
  const [rows, setRows] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [neu, setNeu] = useState(EMPTY_NEW);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    setLoadErr(null);
    const { data, error } = await supabase
      .from("rl_risk")
      .select("id,cause,event,effect,probability,impact,response_category,residual_probability,residual_impact,risk_owner,status,projectnumber,missed_risk")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setLoadErr(error.message);
    setRows((data as Risk[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, p: Partial<Risk>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await fetch(`${BP}/api/risk/update/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, patch: p }),
    });
  }

  async function add() {
    if (!neu.event.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${BP}/api/risk/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ risk: { ...neu, captured_stage: "meeting" } }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "add failed");
      setNeu(EMPTY_NEW);
      await load();
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "add failed");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 max-w-full">
      <h1 className="text-2xl font-semibold mb-1">Risk register</h1>
      <p className="text-gray-600 mb-4 text-sm">
        One row per risk. Edit inline; add on the bottom row. <strong>Score</strong> = likelihood × impact
        (inherent); <strong>Residual</strong> = the same after the response is applied.
      </p>

      {loadErr && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Couldn&apos;t load risks: {loadErr} (expected until the DB is migrated and you&apos;re signed in).
        </div>
      )}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2 font-medium">Risk (cause → event → effect)</th>
              <th className="px-2 py-2 font-medium">L&apos;hood</th>
              <th className="px-2 py-2 font-medium">Impact</th>
              <th className="px-2 py-2 font-medium">Score</th>
              <th className="px-2 py-2 font-medium">Response</th>
              <th className="px-2 py-2 font-medium bg-gray-100">Res. L</th>
              <th className="px-2 py-2 font-medium bg-gray-100">Res. I</th>
              <th className="px-2 py-2 font-medium bg-gray-100">Residual</th>
              <th className="px-2 py-2 font-medium">Owner</th>
              <th className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50">
                <td className="px-3 py-2 min-w-[280px]">
                  <div>{r.event}</div>
                  {(r.cause || r.effect) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {r.cause && <>due to {r.cause}</>}
                      {r.cause && r.effect && " · "}
                      {r.effect && <>→ {r.effect}</>}
                    </div>
                  )}
                  {r.missed_risk && <span className="text-[10px] text-red-600">missed risk</span>}
                </td>
                <td className="px-2 py-2"><Cell value={r.probability} options={LEVELS} onChange={(v) => patch(r.id, { probability: v || null })} /></td>
                <td className="px-2 py-2"><Cell value={r.impact} options={LEVELS} onChange={(v) => patch(r.id, { impact: v || null })} /></td>
                <td className="px-2 py-2"><Score prob={r.probability} impact={r.impact} /></td>
                <td className="px-2 py-2"><Cell value={r.response_category} options={RESPONSES} onChange={(v) => patch(r.id, { response_category: v || null })} /></td>
                <td className="px-2 py-2 bg-gray-50/50"><Cell value={r.residual_probability} options={LEVELS} onChange={(v) => patch(r.id, { residual_probability: v || null })} /></td>
                <td className="px-2 py-2 bg-gray-50/50"><Cell value={r.residual_impact} options={LEVELS} onChange={(v) => patch(r.id, { residual_impact: v || null })} /></td>
                <td className="px-2 py-2 bg-gray-50/50"><Score prob={r.residual_probability} impact={r.residual_impact} /></td>
                <td className="px-2 py-2"><OwnerCell value={r.risk_owner} onSave={(v) => patch(r.id, { risk_owner: v || null })} /></td>
                <td className="px-2 py-2"><Cell value={r.status} options={STATUS} onChange={(v) => patch(r.id, { status: v })} /></td>
              </tr>
            ))}

            {/* add row — residual is set later, after the response is agreed */}
            <tr className="bg-blue-50/40 align-top">
              <td className="px-3 py-2">
                <input
                  value={neu.event}
                  onChange={(e) => setNeu((s) => ({ ...s, event: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") add(); }}
                  placeholder="there is a risk that…"
                  className="w-full border rounded px-2 py-1"
                />
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input value={neu.cause} onChange={(e) => setNeu((s) => ({ ...s, cause: e.target.value }))} placeholder="due to… (optional)" className="border rounded px-2 py-1 text-xs" />
                  <input value={neu.effect} onChange={(e) => setNeu((s) => ({ ...s, effect: e.target.value }))} placeholder="→ leading to… (optional)" className="border rounded px-2 py-1 text-xs" />
                </div>
              </td>
              <td className="px-2 py-2"><Cell value={neu.probability} options={LEVELS} onChange={(v) => setNeu((s) => ({ ...s, probability: v }))} /></td>
              <td className="px-2 py-2"><Cell value={neu.impact} options={LEVELS} onChange={(v) => setNeu((s) => ({ ...s, impact: v }))} /></td>
              <td className="px-2 py-2"><Score prob={neu.probability || null} impact={neu.impact || null} /></td>
              <td className="px-2 py-2"><Cell value={neu.response_category} options={RESPONSES} onChange={(v) => setNeu((s) => ({ ...s, response_category: v }))} /></td>
              <td className="px-2 py-2 bg-gray-50/50 text-center text-gray-300 text-xs">—</td>
              <td className="px-2 py-2 bg-gray-50/50 text-center text-gray-300 text-xs">—</td>
              <td className="px-2 py-2 bg-gray-50/50 text-center text-gray-300 text-xs">—</td>
              <td className="px-2 py-2"><input value={neu.risk_owner} onChange={(e) => setNeu((s) => ({ ...s, risk_owner: e.target.value }))} className="w-full border rounded px-2 py-1" /></td>
              <td className="px-2 py-2">
                <button onClick={add} disabled={adding || !neu.event.trim()} className="bg-[#061b37] text-white px-3 py-1 rounded text-xs disabled:opacity-50 whitespace-nowrap">
                  {adding ? "…" : "Add"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {loading && <p className="text-gray-400 text-sm mt-3">Loading…</p>}
    </div>
  );
}

function Cell({ value, options, onChange }: { value: string | null; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full border rounded px-1 py-1 bg-white text-sm">
      {options.map((o) => (
        <option key={o} value={o}>{o || "—"}</option>
      ))}
    </select>
  );
}

function OwnerCell({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== (value ?? "")) onSave(v); }}
      className="w-full border rounded px-2 py-1"
    />
  );
}
