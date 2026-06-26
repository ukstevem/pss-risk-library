"""
Risk Library embedding-proxy.

A small, stable HTTP contract in front of the Orin's Ollama embedding endpoint.
It is the *one* place that:
  - applies the model's asymmetric role prefixes (search_query: / search_document:),
    so capture and search can never drift,
  - L2-normalises vectors,
  - pins the model name / version / dimension reported back to callers.

This decouples the portal from the serving backend (swap Ollama <-> TEI <-> a future
GPU without touching the app) and is the seam where phase-2 synthesis routing/caching
would later live. Internal-only: reached as http://embedding-proxy:8009 on platform_net;
never gateway-fronted.

Contract:
  POST /embed  { "texts": ["..."], "role": "query" | "document" }
            -> { "model": "...", "version": "...", "dim": 768, "vectors": [[...], ...] }
  GET  /health -> { "ok": true, ... }
"""

import math
import os
from typing import List, Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

ORIN_URL = os.environ.get("EMBEDDING_ORIN_URL", "http://10.0.0.74:11434").rstrip("/")
MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
MODEL_VERSION = os.environ.get("EMBEDDING_MODEL_VERSION", "nomic-embed-text-v1.5")
DIM = int(os.environ.get("EMBEDDING_DIM", "768"))
TIMEOUT = float(os.environ.get("EMBEDDING_TIMEOUT", "30"))

# nomic-embed-text is asymmetric: queries and documents take different task prefixes.
# The proxy owns this mapping so on-save and on-search embeddings stay consistent.
PREFIX = {"query": "search_query: ", "document": "search_document: "}

app = FastAPI(title="risk-library embedding-proxy")


class EmbedRequest(BaseModel):
    texts: List[str]
    role: Literal["query", "document"]


class EmbedResponse(BaseModel):
    model: str
    version: str
    dim: int
    vectors: List[List[float]]


def l2_normalize(v: List[float]) -> List[float]:
    norm = math.sqrt(sum(x * x for x in v))
    return [x / norm for x in v] if norm > 0 else v


async def _embed_via_ollama(inputs: List[str]) -> List[List[float]]:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Prefer the batch endpoint (newer Ollama: POST /api/embed { model, input }).
        r = await client.post(f"{ORIN_URL}/api/embed", json={"model": MODEL, "input": inputs})
        if r.status_code != 404:
            r.raise_for_status()
            embs = r.json().get("embeddings")
            if embs:
                return embs
        # Fallback for older Ollama: POST /api/embeddings { model, prompt } per text.
        out: List[List[float]] = []
        for text in inputs:
            r = await client.post(f"{ORIN_URL}/api/embeddings", json={"model": MODEL, "prompt": text})
            r.raise_for_status()
            out.append(r.json()["embedding"])
        return out


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "version": MODEL_VERSION, "dim": DIM, "orin": ORIN_URL}


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    if not req.texts:
        return EmbedResponse(model=MODEL, version=MODEL_VERSION, dim=DIM, vectors=[])

    inputs = [PREFIX[req.role] + t for t in req.texts]
    try:
        raw = await _embed_via_ollama(inputs)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"embedding backend error: {exc}")

    for v in raw:
        if len(v) != DIM:
            raise HTTPException(
                status_code=500, detail=f"dimension mismatch: expected {DIM}, got {len(v)}"
            )
    return EmbedResponse(
        model=MODEL,
        version=MODEL_VERSION,
        dim=DIM,
        vectors=[l2_normalize(v) for v in raw],
    )
