"use client";

import { useRef, useState } from "react";

const BP = "/risk-library";
const RESPONSES = ["", "avoid", "reduce", "transfer", "accept", "contingency"];

// Fast "save and add another" entry for the cold-start brain-dump of recurring risks.
export default function Seed() {
  const [cause, setCause] = useState("");
  const [event, setEvent] = useState("");
  const [effect, setEffect] = useState("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const eventRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!event.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${BP}/api/risk/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          risk: { cause, event, effect, response_category: response, captured_stage: "meeting" },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      setCount((c) => c + 1);
      setCause("");
      setEvent("");
      setEffect("");
      eventRef.current?.focus();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Seed the library</h1>
      <p className="text-gray-600 mb-5 text-sm">
        Brain-dump the risks that bite repeatedly. Type the <em>event</em>, hit save, repeat.
        Cause/effect optional. Captured this session: <strong>{count}</strong>.
      </p>

      <div className="space-y-3">
        <Row label="Due to (cause)" value={cause} onChange={setCause} />
        <Row label="…there is a risk that (event) *" value={event} onChange={setEvent} inputRef={eventRef}
          onEnter={save} />
        <Row label="…which could lead to (effect)" value={effect} onChange={setEffect} onEnter={save} />
        <label className="block text-sm">
          <span className="text-gray-600">Typical response</span>
          <select value={response} onChange={(e) => setResponse(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 bg-white">
            {RESPONSES.map((o) => (
              <option key={o} value={o}>{o || "—"}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy || !event.trim()} className="bg-[#061b37] text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {busy ? "Saving…" : "Save & add another"}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}

function Row({
  label, value, onChange, inputRef, onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onEnter?.();
        }}
        className="mt-1 w-full border rounded px-2 py-1.5"
      />
    </label>
  );
}
