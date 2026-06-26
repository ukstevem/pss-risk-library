"use client";

import { useState } from "react";

const BP = "/risk-library";
const RESPONSES = ["", "avoid", "reduce", "transfer", "accept", "contingency"];
const LEVELS = ["", "low", "medium", "high"];

type RiskForm = {
  title: string;
  cause: string;
  event: string;
  effect: string;
  probability: string;
  impact: string;
  proximity: string;
  response_category: string;
  risk_owner: string;
  projectnumber: string;
  captured_stage: string;
  missed_risk: boolean;
};

const EMPTY: RiskForm = {
  title: "", cause: "", event: "", effect: "", probability: "", impact: "",
  proximity: "", response_category: "", risk_owner: "", projectnumber: "",
  captured_stage: "", missed_risk: false,
};

export default function Capture() {
  const [f, setF] = useState<RiskForm>(EMPTY);
  const [materialized, setMaterialized] = useState(false);
  const [iss, setIss] = useState({ description: "", result: "", escalated: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function up<K extends keyof RiskForm>(k: K, v: RiskForm[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { risk: f };
      if (materialized && iss.description.trim()) body.issue = iss;
      const res = await fetch(`${BP}/api/risk/capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      setMsg({ ok: true, text: `Saved — risk ${String(json.riskId).slice(0, 8)}…` });
      setF((s) => ({ ...s, title: "", cause: "", event: "", effect: "" }));
      setMaterialized(false);
      setIss({ description: "", result: "", escalated: false });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "save failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Capture a risk</h1>
      <p className="text-gray-600 mb-5 text-sm">
        Write it as cause → event → effect. Only the <em>event</em> is required.
      </p>

      <div className="space-y-3">
        <Text label="Title (optional)" value={f.title} onChange={(v) => up("title", v)} />
        <Text label="Cause — &ldquo;due to …&rdquo;" value={f.cause} onChange={(v) => up("cause", v)} />
        <Text label="Event — &ldquo;there is a risk that …&rdquo; *" value={f.event} onChange={(v) => up("event", v)} />
        <Text label="Effect — &ldquo;which could lead to …&rdquo;" value={f.effect} onChange={(v) => up("effect", v)} />

        <div className="grid grid-cols-3 gap-3">
          <Select label="Probability" value={f.probability} onChange={(v) => up("probability", v)} options={LEVELS} />
          <Select label="Impact" value={f.impact} onChange={(v) => up("impact", v)} options={LEVELS} />
          <Text label="Proximity" value={f.proximity} onChange={(v) => up("proximity", v)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Response" value={f.response_category} onChange={(v) => up("response_category", v)} options={RESPONSES} />
          <Text label="Risk owner" value={f.risk_owner} onChange={(v) => up("risk_owner", v)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Text label="Project number (optional)" value={f.projectnumber} onChange={(v) => up("projectnumber", v)} />
          <Select label="Captured at" value={f.captured_stage} onChange={(v) => up("captured_stage", v)} options={["", "meeting", "closeout"]} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.missed_risk} onChange={(e) => up("missed_risk", e.target.checked)} />
          Elevate to issue — this was a <strong>missed risk</strong> (never foreseen)
        </label>

        <label className="flex items-center gap-2 text-sm border-t pt-3">
          <input type="checkbox" checked={materialized} onChange={(e) => setMaterialized(e.target.checked)} />
          This risk has already happened (record the issue)
        </label>

        {materialized && (
          <div className="space-y-3 border-l-2 border-gray-200 pl-3">
            <Text label="What actually happened *" value={iss.description} onChange={(v) => setIss((s) => ({ ...s, description: v }))} />
            <Text label="Result / impact" value={iss.result} onChange={(v) => setIss((s) => ({ ...s, result: v }))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={iss.escalated} onChange={(e) => setIss((s) => ({ ...s, escalated: e.target.checked }))} />
              Escalated beyond the project manager
            </label>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={submit} disabled={busy || !f.event.trim()} className="bg-[#061b37] text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {busy ? "Saving…" : "Save risk"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 bg-white">
        {options.map((o) => (
          <option key={o} value={o}>{o || "—"}</option>
        ))}
      </select>
    </label>
  );
}
