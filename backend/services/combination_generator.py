from __future__ import annotations
from datetime import date

VALID_RULES = {"initials", "symbol", "birthdate"}
RULE_ORDER = ["initials", "symbol", "birthdate"]
BIRTHDATE_PART_ORDER = ["day", "month", "year"]


def generate_combination(
    rules: list[str],
    names: list[str] | None = None,
    symbol: str | None = None,
    birth_date: date | None = None,
    birth_date_parts: list[str] | None = None,
) -> str:
    """Builds the combination string from the selected rule types, in fixed
    order (initials -> symbol -> birthdate), concatenated with no separator."""
    if not rules:
        raise ValueError("At least one combination rule must be selected.")

    unknown = set(rules) - VALID_RULES
    if unknown:
        raise ValueError(f"Unknown combination rule(s): {', '.join(sorted(unknown))}")

    selected_rules = [r for r in RULE_ORDER if r in rules]
    parts: list[str] = []

    if "initials" in selected_rules:
        cleaned = [n.strip() for n in (names or []) if n.strip()]
        if not cleaned:
            raise ValueError("'initials' rule requires at least one name.")
        parts.append("".join(n[0].upper() for n in cleaned))

    if "symbol" in selected_rules:
        if not symbol:
            raise ValueError("'symbol' rule requires a symbol.")
        parts.append(symbol)

    if "birthdate" in selected_rules:
        if not birth_date or not birth_date_parts:
            raise ValueError(
                "'birthdate' rule requires a birth_date and at least one of day/month/year."
            )
        selected_parts = [p for p in BIRTHDATE_PART_ORDER if p in birth_date_parts]
        if not selected_parts:
            raise ValueError("birth_date_parts must include at least one of day/month/year.")

        piece = ""
        for part in selected_parts:
            if part == "day":
                piece += f"{birth_date.day:02d}"
            elif part == "month":
                piece += f"{birth_date.month:02d}"
            elif part == "year":
                piece += str(birth_date.year)
        parts.append(piece)

    return "".join(parts)
