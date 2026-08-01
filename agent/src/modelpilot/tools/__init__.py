"""Tool registry — the surface the model can call.

Each tool is a `StructuredTool` whose argument schema is a Pydantic model from
`schemas.py`, so LangChain generates the JSON Schema the API sees and validates
arguments before our code runs.
"""

from __future__ import annotations

from langchain_core.tools import StructuredTool

from ..schemas import (
    CalculateArgs,
    CompareCostsArgs,
    EstimateCostArgs,
    FetchUrlArgs,
    GetModelArgs,
    QueryModelsArgs,
    SearchDocsArgs,
    WebSearchArgs,
)
from . import calc, catalog, cost, docs, web

QUERY_MODELS = StructuredTool.from_function(
    func=catalog.query_models,
    name="query_models",
    description=catalog.QUERY_MODELS_DESCRIPTION,
    args_schema=QueryModelsArgs,
)

GET_MODEL = StructuredTool.from_function(
    func=catalog.get_model,
    name="get_model",
    description=catalog.GET_MODEL_DESCRIPTION,
    args_schema=GetModelArgs,
)

SEARCH_MODEL_DOCS = StructuredTool.from_function(
    func=docs.search_model_docs,
    name="search_model_docs",
    description=docs.SEARCH_DOCS_DESCRIPTION,
    args_schema=SearchDocsArgs,
)

ESTIMATE_COST = StructuredTool.from_function(
    func=cost.estimate_cost,
    name="estimate_cost",
    description=cost.ESTIMATE_COST_DESCRIPTION,
    args_schema=EstimateCostArgs,
)

COMPARE_COSTS = StructuredTool.from_function(
    func=cost.compare_costs,
    name="compare_costs",
    description=cost.COMPARE_COSTS_DESCRIPTION,
    args_schema=CompareCostsArgs,
)

CALCULATE = StructuredTool.from_function(
    func=calc.calculate,
    name="calculate",
    description=calc.CALCULATE_DESCRIPTION,
    args_schema=CalculateArgs,
)

WEB_SEARCH = StructuredTool.from_function(
    func=web.web_search,
    name="web_search",
    description=web.WEB_SEARCH_DESCRIPTION,
    args_schema=WebSearchArgs,
)

FETCH_URL = StructuredTool.from_function(
    func=web.fetch_url,
    name="fetch_url",
    description=web.FETCH_URL_DESCRIPTION,
    args_schema=FetchUrlArgs,
)

ALL_TOOLS: list[StructuredTool] = [
    QUERY_MODELS,
    GET_MODEL,
    SEARCH_MODEL_DOCS,
    ESTIMATE_COST,
    COMPARE_COSTS,
    CALCULATE,
    WEB_SEARCH,
    FETCH_URL,
]

TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}

__all__ = ["ALL_TOOLS", "TOOLS_BY_NAME"]
