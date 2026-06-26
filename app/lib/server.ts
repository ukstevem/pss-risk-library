// Server-only helpers (API routes). Uses the service key to write rows and call
// the match RPC; the app sits behind platform auth on the LAN, so this is fine for the PoC.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Placeholder fallbacks so `next build` (no env) doesn't throw at import time;
// real values are present at runtime (mirrors @platform/supabase).
export const supabaseAdmin = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder",
  { auth: { persistSession: false } }
);

const PROXY = process.env.EMBEDDING_PROXY_URL ?? "http://embedding-proxy:8009";

export type EmbedResult = { model: string; version: string; dim: number; vectors: number[][] };

export async function embed(texts: string[], role: "query" | "document"): Promise<EmbedResult> {
  const res = await fetch(`${PROXY}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts, role }),
  });
  if (!res.ok) throw new Error(`embedding-proxy returned ${res.status}`);
  return res.json();
}

// pgvector over PostgREST takes the vector as a "[v1,v2,...]" string literal.
export function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

export function riskEmbedText(r: { title?: string; cause?: string; event: string; effect?: string }): string {
  return [r.title, r.cause, r.event, r.effect].filter(Boolean).join(". ").trim();
}

export function issueEmbedText(i: { description: string; result?: string }): string {
  return [i.description, i.result].filter(Boolean).join(". ").trim();
}
