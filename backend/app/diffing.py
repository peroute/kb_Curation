"""Line diffs in the shape the UI renders (GitHub style)."""
from __future__ import annotations

import difflib
import re


def line_diff(old: str, new: str, context: int = 2, limit: int = 600) -> tuple[list[dict], int, int]:
    a, b = (old or "").splitlines(), (new or "").splitlines()
    out: list[dict] = []
    added = removed = 0
    for line in difflib.unified_diff(a, b, n=context, lineterm=""):
        if line.startswith(("---", "+++")):
            continue
        if line.startswith("@@"):
            out.append({"t": "@", "s": line})
        elif line.startswith("+"):
            added += 1
            out.append({"t": "+", "s": line[1:]})
        elif line.startswith("-"):
            removed += 1
            out.append({"t": "-", "s": line[1:]})
        else:
            out.append({"t": " ", "s": line[1:]})
    if len(out) > limit:
        out = out[:limit] + [{"t": "@", "s": f"… {len(out) - limit} more lines not shown"}]
    return out, added, removed


def word_diff(old: str, new: str, limit: int = 4000) -> list[dict]:
    """Word-level diff as segments {"t": "=" | "-" | "+", "s": text}; past `limit` tokens the rest is one removal plus one addition."""
    a, b = (re.findall(r"\s+|\w+|[^\w\s]", x or "") for x in (old, new))
    out: list[dict] = []

    def put(t: str, s: str) -> None:
        if not s:
            return
        if out and out[-1]["t"] == t:
            out[-1]["s"] += s
        else:
            out.append({"t": t, "s": s})

    sm = difflib.SequenceMatcher(None, a[:limit], b[:limit], autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            put("=", "".join(a[i1:i2]))
        else:
            put("-", "".join(a[i1:i2]))
            put("+", "".join(b[j1:j2]))
    put("-", "".join(a[limit:]))
    put("+", "".join(b[limit:]))
    return out


def similar(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a or "", b or "", autojunk=False).quick_ratio()
