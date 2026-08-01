"""A calculator that is safe to hand to a language model.

`eval()` on model-generated text is remote code execution. This walks the AST and
rejects any node that is not arithmetic, so the worst case is a ValueError.
"""

from __future__ import annotations

import ast
import json
import math
import operator

from ..schemas import CalculateArgs

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}

# A deliberately small surface. No attribute access, no names beyond these.
_FUNCS = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "log": math.log,
    "log10": math.log10,
    "sqrt": math.sqrt,
    "ceil": math.ceil,
    "floor": math.floor,
}
_CONSTS = {"pi": math.pi, "e": math.e}

MAX_EXPONENT = 64  # keep 2**10**10 from hanging the process


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise ValueError(f"only numeric literals are allowed, got {node.value!r}")
        return node.value
    if isinstance(node, ast.BinOp):
        op = _BIN_OPS.get(type(node.op))
        if op is None:
            raise ValueError(f"operator {type(node.op).__name__} is not allowed")
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > MAX_EXPONENT:
            raise ValueError(f"exponent {right} exceeds the limit of {MAX_EXPONENT}")
        return op(left, right)
    if isinstance(node, ast.UnaryOp):
        op = _UNARY_OPS.get(type(node.op))
        if op is None:
            raise ValueError(f"unary {type(node.op).__name__} is not allowed")
        return op(_eval(node.operand))
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _FUNCS:
            raise ValueError(f"only these functions are allowed: {sorted(_FUNCS)}")
        if node.keywords:
            raise ValueError("keyword arguments are not allowed")
        return _FUNCS[node.func.id](*[_eval(a) for a in node.args])
    if isinstance(node, ast.Name):
        if node.id not in _CONSTS:
            raise ValueError(f"unknown name {node.id!r}; allowed: {sorted(_CONSTS)}")
        return _CONSTS[node.id]
    if isinstance(node, (ast.List, ast.Tuple)):
        return [_eval(e) for e in node.elts]  # type: ignore[return-value]
    raise ValueError(f"{type(node).__name__} is not allowed in an expression")


def safe_eval(expression: str) -> float:
    if len(expression) > 500:
        raise ValueError("expression too long")
    tree = ast.parse(expression, mode="eval")
    return _eval(tree)


def calculate(**kwargs) -> str:
    """Evaluate an arithmetic expression."""
    try:
        args = CalculateArgs.model_validate(kwargs)
        value = safe_eval(args.expression)
    except SyntaxError as exc:
        return json.dumps({"error": f"could not parse expression: {exc}", "tool": "calculate"})
    except Exception as exc:
        return json.dumps({"error": str(exc), "tool": "calculate"})
    return json.dumps({"expression": args.expression, "result": value})


CALCULATE_DESCRIPTION = """\
Evaluate an arithmetic expression (+ - * / // % **, plus abs, round, min, max, sum, log, \
log10, sqrt, ceil, floor, and the constants pi and e). Use it for ad-hoc math like unit \
conversions or ratios. For model pricing use estimate_cost or compare_costs instead — \
those read real prices from the catalog."""
