"""Full-text search over the catalog's prose write-ups."""

from __future__ import annotations

import json

from .. import db
from ..retry import as_tool_error
from ..schemas import SearchDocsArgs


def search_model_docs(**kwargs) -> str:
    """Search the model write-ups for qualitative guidance."""
    try:
        args = SearchDocsArgs.model_validate(kwargs)
        hits = db.search_docs(args.query, args.k)
    except Exception as exc:
        return as_tool_error("search_model_docs", exc).model_dump_json()

    if not hits:
        return json.dumps(
            {
                "results": [],
                "note": "No matching passages. Try fewer or more common words.",
            }
        )

    return json.dumps(
        {
            "count": len(hits),
            "results": [
                {"slug": h.slug, "name": h.name, "heading": h.heading, "snippet": h.snippet}
                for h in hits
            ],
        }
    )


SEARCH_DOCS_DESCRIPTION = """\
Full-text search over the catalog's written guidance on each model ("when to reach for \
X", trade-offs, caveats). Use it for qualitative questions that structured filters can't \
answer, and to find supporting detail worth quoting. Results carry the model slug so you \
can cite them."""
