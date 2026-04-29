"""Tiny helpers for safe text used inside SQL string operators.

Keep small and focused. Anywhere user input feeds an ILIKE / LIKE
pattern, route it through `like_escape` first so a search query of
'%' doesn't match every row (DoS) and an attacker can't probe with
the underscore wildcard.
"""

# `\` is the escape character. The order matters — escape the
# backslash first or we'll double-escape our own escapes.
_LIKE_SPECIALS = (("\\", "\\\\"), ("%", "\\%"), ("_", "\\_"))


def like_escape(s: str) -> str:
    """Escape `%` and `_` in user input so they're treated as literal
    characters by SQL LIKE/ILIKE. Pair with `escape="\\\\"` on the call:

        Model.name.ilike(f"%{like_escape(q)}%", escape="\\\\")
    """
    out = s or ""
    for needle, replacement in _LIKE_SPECIALS:
        out = out.replace(needle, replacement)
    return out
