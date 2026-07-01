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

type Action = {
  id: string;
  action_text: string;
  response_type: string | null;
  actionee: string | null;
  phase: string;
  action_date: string | null;
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
const EMPTY_DRAFT = { action_text: "", response_type: "", actionee: "" };

export default function Register() {
  const [rows, setRows] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [neu, setNeu] = useState(EMPTY_NEW);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState<Record<string, Action[]>>({});
  const [drafts, setDrafts] = useState<Record<string, typeof EMPTY_DRAFT>>({});

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

  async function loadActions(id: string) {
    const { data } = await supabase
      .from("rl_action")
      .select("id,action_text,response_type,actionee,phase,action_date")
      .eq("risk_id", id)
      .order("created_at", { ascending: true });
    setActions((a) => ({ ...a, [id]: (data as Action[]) ?? [] }));
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (!actions[id]) loadActions(id);
      }
      return next;
    });
  }

  async function addAction(id: string) {
    const d = drafts[id] ?? EMPTY_DRAFT;
    if (!d.action_text.trim()) return;
    const res = await fetch(`${BP}/api/risk/action/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ risk_id: id, ...d, phase: "risk_mitigation" }),
    });
    const json = await res.json();
    if (res.ok && json.action) {
      setActions((a) => ({ ...a, [id]: [...(a[id] ?? []), json.action] }));
      setDrafts((dd) => ({ ...dd, [id]: EMPTY_DRAFT }));
    }
  }

  function setDraft(id: string, patch: Partial<typeof EMPTY_DRAFT>) {
    setDrafts((dd) => ({ ...dd, [id]: { ...(dd[id] ?? EMPTY_DRAFT), ...patch } }));
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
        One row per risk. Edit inline; expand a row (▸) to record the treatment — what you&apos;ll do —
        and the residual level after it. <strong>Score</strong> = likelihood × impact.
      </p>

      {loadErr && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Couldn&apos;t load risks: {loadErr} (expected until the DB is migrated and you&apos;re signed in).
        </div>
      )}

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-2 py-2 w-6"></th>
              <th className="px-3 py-2 font-medium">Risk (cause → event → effect)</th>
              <th className="px-2 py-2 font-medium">L&apos;hood</th>
              <th className="px-2 py-2 font-medium">Impact</th>
              <th className="px-2 py-2 font-medium">Score</th>
              <th className="px-2 py-2 font-medium">Response</th>
              <th className="px-2 py-2 font-medium">Residual</th>
              <th className="px-2 py-2 font-medium">Owner</th>
              <th className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const open = expanded.has(r.id);
              return (
                <FragmentRow key={r.id}>
                  <tr className="align-top hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <button onClick={() => toggle(r.id)} className="text-gray-400 hover:text-gray-700">{open ? "▾" : "▸"}</button>
                    </td>
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
                    <td className="px-2 py-2"><Score prob={r.residual_probability} impact={r.residual_impact} /></td>
                    <td className="px-2 py-2"><OwnerCell value={r.risk_owner} onSave={(v) => patch(r.id, { risk_owner: v || null })} /></td>
                    <td className="px-2 py-2"><Cell value={r.status} options={STATUS} onChange={(v) => patch(r.id, { status: v })} /></td>
                  </tr>
                  {open && (
                    <tr className="bg-gray-50/60">
                      <td></td>
                      <td colSpan={8} className="px-3 py-3">
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Treatment — what we'll do */}
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Treatment — what we&apos;ll do</div>
                            <ul className="space-y-1 mb-2">
                              {(actions[r.id] ?? []).map((a) => (
                                <li key={a.id} className="text-sm flex gap-2">
                                  <span className="text-gray-300">•</span>
                                  <span>
                                    {a.action_text}
                                    {a.response_type && <span className="ml-2 text-[10px] bg-gray-200 rounded px-1.5 py-0.5">{a.response_type}</span>}
                                    {a.actionee && <span className="ml-2 text-xs text-gray-400">— {a.actionee}</span>}
                                  </span>
                                </li>
                              ))}
                              {(actions[r.id]?.length ?? 0) === 0 && <li className="text-xs text-gray-400">No actions yet.</li>}
                            </ul>
                            <div className="flex gap-2">
                              <input
                                value={(drafts[r.id] ?? EMPTY_DRAFT).action_text}
                                onChange={(e) => setDraft(r.id, { action_text: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") addAction(r.id); }}
                                placeholder="e.g. dual-source the steel; confirm delivery in writing"
                                className="flex-1 border rounded px-2 py-1 text-sm"
                              />
                              <input
                                value={(drafts[r.id] ?? EMPTY_DRAFT).actionee}
                                onChange={(e) => setDraft(r.id, { actionee: e.target.value })}
                                placeholder="owner"
                                className="w-24 border rounded px-2 py-1 text-sm"
                              />
                              <button onClick={() => addAction(r.id)} className="bg-[#061b37] text-white px-3 py-1 rounded text-xs">Add</button>
                            </div>
                          </div>
                          {/* Residual — the new levels after treatment */}
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Residual (after treatment)</div>
                            <div className="flex items-end gap-3">
                              <label className="text-sm">
                                <span className="text-gray-600 text-xs">Likelihood</span>
                                <Cell value={r.residual_probability} options={LEVELS} onChange={(v) => patch(r.id, { residual_probability: v || null })} />
                              </label>
                              <label className="text-sm">
                                <span className="text-gray-600 text-xs">Impact</span>
                                <Cell value={r.residual_impact} options={LEVELS} onChange={(v) => patch(r.id, { residual_impact: v || null })} />
                              </label>
                              <div className="text-sm">
                                <div className="text-gray-600 text-xs mb-1">Residual</div>
                                <Score prob={r.residual_probability} impact={r.residual_impact} />
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">The risk level you expect once the treatment above is in place.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}

            {/* add row */}
            <tr className="bg-blue-50/40 align-top">
              <td></td>
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
              <td className="px-2 py-2 text-gray-300 text-xs text-center">—</td>
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

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
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
