#!/usr/bin/env python
"""Build a supply / materials / weld-procedure picture from PSS technical reviews.

Technical reviews are shallow on *risks* but rich on *structured fact*. This reads
the review PDFs, extracts structured facts per review via the local LLM (Ollama),
prints them, then summarises the aggregate picture + conclusions/outliers.

Usage:  python scripts/review_facts.py [docs_dir]     (default docs_dir = ./docs)
Env:    LLM_URL (default http://127.0.0.1:11434), LLM_MODEL (default qwen2.5:7b)
Deps:   pypdf   (pip install pypdf)
"""
import sys, os, glob, json, urllib.request
from pypdf import PdfReader

OLLAMA = os.environ.get("LLM_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("LLM_MODEL", "qwen2.5:7b")


def chat(messages, fmt=None):
    body = {"model": MODEL, "stream": False, "options": {"temperature": 0}, "messages": messages}
    if fmt:
        body["format"] = fmt
    req = urllib.request.Request(f"{OLLAMA}/api/chat", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=300))["message"]["content"]


FACTS_SCHEMA = {
    "type": "object",
    "properties": {
        "project": {"type": "string"}, "material": {"type": "string"}, "material_origin": {"type": "string"},
        "weld_standard": {"type": "string"}, "welder_qualification": {"type": "string"}, "ndt": {"type": "string"},
        "inspection_class": {"type": "string"}, "consumables": {"type": "string"}, "coating_finish": {"type": "string"},
        "suppliers": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["material", "weld_standard", "ndt", "suppliers"],
}

FACTS_SYS = (
    "Extract structured facts from a fabrication/welding technical review. Fields: project (name/number if "
    "present), material (grade/type), material_origin, weld_standard (e.g. EN 5817 level), welder_qualification "
    "(e.g. EN 9606-1), ndt (method + coverage), inspection_class, consumables (standard), coating_finish, and "
    "suppliers (named suppliers, else []). Use '' / [] when not stated. Do not invent."
)

FIELDS = ["project", "material", "material_origin", "weld_standard", "welder_qualification",
          "ndt", "inspection_class", "consumables", "coating_finish"]


def read_pdf(p):
    return "\n".join((pg.extract_text() or "") for pg in PdfReader(p).pages)


def main():
    docs = sys.argv[1] if len(sys.argv) > 1 else "docs"
    pdfs = sorted(glob.glob(os.path.join(docs, "*.pdf")))
    if not pdfs:
        print(f"No PDFs found in {docs}")
        return

    facts = []
    for p in pdfs:
        name = os.path.basename(p)
        f = json.loads(chat(
            [{"role": "system", "content": FACTS_SYS},
             {"role": "user", "content": "Technical review:\n" + read_pdf(p)[:8000]}],
            FACTS_SCHEMA))
        f["_source"] = name
        facts.append(f)
        print(f"\n=== {name} ===")
        for k in FIELDS:
            if f.get(k):
                print(f"  {k:22} {f[k]}")
        if f.get("suppliers"):
            print(f"  {'suppliers':22} {', '.join(f['suppliers'])}")

    summary = chat([
        {"role": "system", "content": "You are analysing structured facts extracted from multiple fabrication "
         "technical reviews. Summarise the TYPICAL supply, materials and weld-procedure picture across the "
         "projects, then note any outliers or conclusions worth drawing. Be concise and concrete; ground "
         "everything in the data provided."},
        {"role": "user", "content": f"Facts from {len(facts)} reviews:\n" + json.dumps(facts, indent=1)},
    ])
    print("\n" + "=" * 64 + "\nSUPPLY / MATERIALS / PROCEDURE PICTURE\n" + "=" * 64)
    print(summary)


if __name__ == "__main__":
    main()
