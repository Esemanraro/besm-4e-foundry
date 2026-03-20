from __future__ import annotations

import json
import re
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "BESM 4e - Corebook - Core Rulebook 4th Edition.pdf"
CATALOGS_PATH = ROOT / "module" / "rules" / "catalogs.mjs"
MODIFIERS_PATH = ROOT / "data" / "modifiers.json"
TEMPLATES_PATH = ROOT / "data" / "template-index.json"
BENCHMARKS_PATH = ROOT / "data" / "benchmarks.json"
OVERRIDES_PATH = ROOT / "data" / "source-overrides.json"
REFERENCE_SEED_PATH = ROOT / "data" / "reference-data.json"
DATA_DIR = ROOT / "data"
PRINTED_PAGE_OFFSET = 2

ITEM_SECTION_SPECS = [
    {"id": "things-and-stuff", "name": "Things and Stuff", "heading": "THINGS AND STUFF", "startPage": 197, "endPage": 198},
    {"id": "weapons-overview", "name": "Weapons", "heading": "WEAPONS", "startPage": 199, "endPage": 206},
    {"id": "armour", "name": "Armour", "heading": "ARMOUR", "startPage": 210, "endPage": 211},
    {"id": "shields", "name": "Shields", "heading": "SHIELDS", "startPage": 212, "endPage": 213},
    {"id": "gear-suits", "name": "Protective and Utility Suits", "heading": "DEEP-SEA DIVING SUIT", "startPage": 214, "endPage": 215},
    {"id": "mecha-and-vehicles", "name": "Mecha and Vehicles", "heading": "MECHA AND VEHICLES", "startPage": 215, "endPage": 221},
    {"id": "adventuring-gear", "name": "Adventuring Gear", "heading": "ADVENTURING GEAR", "startPage": 221, "endPage": 222},
    {"id": "items-of-power", "name": "Items of Power", "heading": "ITEMS OF POWER", "startPage": 222, "endPage": 222},
    {"id": "breaking-items", "name": "Breaking Items", "heading": "BREAKING ITEMS", "startPage": 223, "endPage": 224},
]

REFERENCE_TABLE_SPECS = [
    {"id": "character-power-levels", "name": "Character Power Levels", "heading": "CHARACTER POWER LEVELS", "startPage": 22, "endPage": 22, "category": "character"},
    {"id": "size-modifiers", "name": "Size Modifiers", "heading": "SIZE MODIFIERS", "startPage": 35, "endPage": 35, "category": "creation"},
    {"id": "character-attributes-index", "name": "Character Attributes Index", "heading": "CHARACTER ATTRIBUTES", "startPage": 77, "endPage": 77, "category": "attributes"},
    {"id": "defects-index", "name": "Defects Index", "heading": "DEFECTS", "startPage": 155, "endPage": 155, "category": "defects"},
    {"id": "item-armour-ratings", "name": "Item Armour Ratings", "heading": "ITEM ARMOUR RATINGS", "startPage": 223, "endPage": 223, "category": "items"},
]

WEAPON_TABLE_SPECS = [
    {"page": 204, "category": "Unarmed Attacks", "attackMode": "melee"},
    {"page": 204, "category": "Splash", "attackMode": "ranged"},
    {"page": 204, "category": "Archaic Melee", "attackMode": "melee"},
    {"page": 205, "category": "Archaic Ranged", "attackMode": "ranged"},
    {"page": 205, "category": "Archaic Siege", "attackMode": "ranged"},
    {"page": 205, "category": "Modern Melee", "attackMode": "melee"},
    {"page": 206, "category": "Modern Ranged", "attackMode": "ranged"},
    {"page": 206, "category": "Modern Ordnance", "attackMode": "ranged"},
    {"page": 207, "category": "Futuristic Melee", "attackMode": "melee"},
    {"page": 207, "category": "Futuristic Ranged", "attackMode": "ranged"},
]

ARMOUR_TABLE_SPECS = [
    {"page": 211, "category": "Animal Armour Type"},
    {"page": 211, "category": "Archaic Armour Type"},
    {"page": 211, "category": "Modern Armour Type"},
    {"page": 211, "category": "Futuristic Armour Type"},
    {"page": 213, "category": "Buckler Shield"},
    {"page": 213, "category": "Small Shield"},
    {"page": 213, "category": "Large Shield"},
    {"page": 213, "category": "Special Shield"},
]


def load_json(path: Path, default: object | None = None) -> object:
    if not path.exists():
        return {} if default is None else default
    return json.loads(path.read_text(encoding="utf-8"))


SEED_REFERENCE = load_json(REFERENCE_SEED_PATH, {})
POWER_LEVELS = SEED_REFERENCE.get("powerLevels", [])
TARGET_NUMBERS = SEED_REFERENCE.get("targetNumbers", [])
SIZE_RANKS = SEED_REFERENCE.get("sizeRanks", {})
SKILL_GROUPS = SEED_REFERENCE.get("skillGroups", [])


def printed_to_pdf_page(printed_page: int) -> int:
    return printed_page + PRINTED_PAGE_OFFSET


def collapse_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_heading(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def dedupe_adjacent_lines(text: str) -> str:
    result = []
    for raw in text.splitlines():
        line = collapse_space(raw)
        if not line:
            continue
        if result and result[-1] == line:
            continue
        result.append(line)
    return "\n".join(result)


def is_noise_block(text: str) -> bool:
    compact = normalize_heading(text)
    if not compact:
        return True
    if compact in {"ITEM", "ITEM S", "ITEMS", "ATTRIB", "UTE", "S", "DEFEC", "TS", "TEMPL", "ATES", "COMPA", "NION"}:
        return True
    if compact in {"PAGE", "PAGE PAGE"}:
        return True
    if compact.startswith("CHAPTER "):
        return True
    if re.fullmatch(r"\d+", compact):
        return True
    if compact.startswith("03 TEMPLATES PAGE PAGE") or compact.startswith("05 ATTRIBUTES PAGE PAGE") or compact.startswith("06 CUSTOMISATION PAGE PAGE") or compact.startswith("07 DEFECTS PAGE PAGE") or compact.startswith("10 ITEMS PAGE PAGE") or compact.startswith("11 COMPANIONS PAGE PAGE") or compact.startswith("02 CHARACTER BASICS PAGE PAGE"):
        return True
    return False


def is_noise_line(line: str) -> bool:
    compact = normalize_heading(line)
    if not compact:
        return True
    if compact in {"ITEM", "ITEMS", "S", "TEMPL", "ATES", "TEMPLATES", "COMPA", "NION", "COMPANIONS", "PAGE", "PAGE PAGE", "U", "X"}:
        return True
    if re.fullmatch(r"\d{2} ITEMS", compact) or re.fullmatch(r"\d{2} TEMPLATES", compact) or re.fullmatch(r"\d{2} COMPANIONS", compact):
        return True
    return False


def load_clean_pages() -> dict[int, list[str]]:
    doc = fitz.open(PDF_PATH)
    pages: dict[int, list[str]] = {}
    for printed_page in range(1, doc.page_count - PRINTED_PAGE_OFFSET + 1):
        page = doc.load_page(printed_to_pdf_page(printed_page) - 1)
        seen = set()
        blocks = []
        for block in sorted(page.get_text("blocks"), key=lambda entry: (round(entry[1], 1), round(entry[0], 1))):
            cleaned = dedupe_adjacent_lines(block[4])
            if not cleaned or cleaned in seen or is_noise_block(cleaned):
                continue
            seen.add(cleaned)
            blocks.append(cleaned)
        pages[printed_page] = blocks
    return pages


def load_text_pages() -> dict[int, list[str]]:
    doc = fitz.open(PDF_PATH)
    pages: dict[int, list[str]] = {}
    for printed_page in range(1, doc.page_count - PRINTED_PAGE_OFFSET + 1):
        page = doc.load_page(printed_to_pdf_page(printed_page) - 1)
        lines = []
        for raw in page.get_text("text").splitlines():
            line = collapse_space(raw)
            if is_noise_line(line):
                continue
            lines.append(line)
        pages[printed_page] = lines
    return pages


def page_text(blocks_by_page: dict[int, list[str]], printed_page: int) -> str:
    return "\n\n".join(blocks_by_page.get(printed_page, []))


def extract_span(blocks_by_page: dict[int, list[str]], start_page: int, end_page: int) -> str:
    return "\n\n".join(page_text(blocks_by_page, page) for page in range(start_page, end_page + 1) if page_text(blocks_by_page, page)).strip()


def extract_section(blocks_by_page: dict[int, list[str]], heading: str, start_page: int, end_page: int, next_heading: str | None = None) -> str:
    target = normalize_heading(heading)
    end_target = normalize_heading(next_heading) if next_heading else None
    found = False
    collected: list[str] = []
    for printed_page in range(start_page, end_page + 1):
        for block in blocks_by_page.get(printed_page, []):
            block_heading = normalize_heading(block)
            if not found:
                if target in block_heading:
                    found = True
                    collected.append(block)
                continue
            if end_target and end_target in block_heading:
                return "\n\n".join(collected).strip()
            collected.append(block)
    return "\n\n".join(collected).strip()


def parse_options(option_text: str) -> dict:
    result: dict[str, object] = {}
    if not option_text:
        return result
    patterns = {
        "costType": r'costType:\s*"([^"]+)"',
        "costPerLevel": r"costPerLevel:\s*([-\d.]+)",
        "sourcePage": r"sourcePage:\s*(\d+)",
        "relevantStat": r'relevantStat:\s*"([^"]+)"',
        "category": r'category:\s*"([^"]+)"',
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, option_text)
        if not match:
            continue
        value = match.group(1)
        result[key] = int(float(value)) if key == "costPerLevel" else int(value) if key == "sourcePage" else value
    for key in ("humanCompatible", "isAttack"):
        if re.search(rf"{key}:\s*true", option_text):
            result[key] = True
    points_match = re.search(r"pointsByRank:\s*\[([^\]]+)\]", option_text)
    if points_match:
        result["pointsByRank"] = [int(collapse_space(value)) for value in points_match.group(1).split(",")]
    automation_match = re.search(r"automation:\s*\{([^}]+)\}", option_text)
    if automation_match:
        automation = {}
        for part in automation_match.group(1).split(","):
            if ":" not in part:
                continue
            key, value = part.split(":", 1)
            automation[collapse_space(key)] = int(float(collapse_space(value)))
        result["automation"] = automation
    return result


def parse_catalog_entries(block_name: str) -> list[dict]:
    source = CATALOGS_PATH.read_text(encoding="utf-8")
    match = re.search(rf"export const {block_name} = \{{(?P<body>.*?)\n\}};", source, re.S)
    if not match:
        raise RuntimeError(f"Unable to parse {block_name} from catalogs.mjs")
    pattern = re.compile(r'^\s*(?P<key>"[^"]+"|[\w-]+): entry\("(?P<id>[^"]+)", "(?P<name>[^"]+)", \{ (?P<opts>.*) \}\),?\s*$', re.M)
    entries = []
    for entry_match in pattern.finditer(match.group("body")):
        entry = {"key": entry_match.group("key").strip('"'), "id": entry_match.group("id"), "name": entry_match.group("name")}
        entry.update(parse_options(entry_match.group("opts")))
        entries.append(entry)
    return entries


def attach_rules_text(entries: list[dict], blocks_by_page: dict[int, list[str]], end_page_limit: int = 400) -> list[dict]:
    enriched = []
    for index, entry in enumerate(entries):
        next_entry = entries[index + 1] if index + 1 < len(entries) else None
        start_page = entry.get("sourcePage", 0)
        next_heading = next_entry["name"] if next_entry else None
        next_page = next_entry.get("sourcePage", start_page) if next_entry else min(start_page + 4, end_page_limit)
        end_page = max(start_page, min(next_page, start_page + 4))
        enriched.append({**entry, "rulesText": extract_section(blocks_by_page, entry["name"], start_page, end_page, next_heading=next_heading)})
    return enriched


def enrich_modifier_group(entries: list[dict], blocks_by_page: dict[int, list[str]]) -> list[dict]:
    enriched = []
    for index, entry in enumerate(entries):
        next_entry = entries[index + 1] if index + 1 < len(entries) else None
        start_page = entry["page"]
        next_heading = next_entry["name"] if next_entry else None
        next_page = next_entry["page"] if next_entry else start_page + 2
        end_page = max(start_page, min(next_page, start_page + 2))
        enriched.append({**entry, "rulesText": extract_section(blocks_by_page, entry["name"], start_page, end_page, next_heading=next_heading), "sourcePage": entry["page"]})
    return enriched


def build_lookup(entries: list[dict]) -> list[tuple[str, str, str]]:
    lookup = [(normalize_key(entry["name"]), entry["id"], entry["name"]) for entry in entries]
    lookup.sort(key=lambda value: len(value[0]), reverse=True)
    return lookup


def resolve_catalog_id(label: str, lookup: list[tuple[str, str, str]]) -> tuple[str | None, str | None]:
    normalized = normalize_key(label)
    for name, entry_id, display_name in lookup:
        if normalized.startswith(name):
            return entry_id, display_name
    return None, None


def find_indices(lines: list[str], value: str) -> list[int]:
    target = normalize_key(value)
    return [index for index, line in enumerate(lines) if normalize_key(line) == target]


def is_value_token(value: str) -> bool:
    return bool(re.fullmatch(r"-?\d+(?:\s*\(-?\d+\))?", value))


def is_int_token(value: str) -> bool:
    return bool(re.fullmatch(r"-?\d+", value))


def parse_primary_number(value: str, default: int = 0) -> int:
    match = re.search(r"-?\d+", value or "")
    return int(match.group(0)) if match else default


def extract_total_points(lines: list[str]) -> int | None:
    for index, line in enumerate(lines):
        if line != "TOTAL" and not line.startswith("TOTAL"):
            continue
        for previous in range(index - 1, -1, -1):
            if is_int_token(lines[previous]):
                return int(lines[previous])
        match = re.search(r"TOTAL \(([-\d]+) POINT ITEM\)", line)
        if match:
            return int(match.group(1))
    return None


def extract_specialization(label: str, catalog_name: str | None) -> str:
    if label.startswith("Weapon:"):
        value = label.split(":", 1)[1].strip()
        return re.sub(r"\s*\(.*\)$", "", value).strip()
    if not catalog_name:
        return ""
    match = re.match(rf"^{re.escape(catalog_name)}\s*\((.*)\)$", label)
    return match.group(1).strip() if match else ""


def parse_stat_table(lines: list[str]) -> tuple[list[dict], dict[str, int]]:
    stats: list[dict] = []
    totals = {"body": 0, "mind": 0, "soul": 0}
    if "STAT" not in lines:
        return stats, totals
    index = lines.index("STAT") + 1
    while index + 2 < len(lines):
        if lines[index] in {"ATTRIBUTE", "DEFECT", "DERIVED VALUE", "TOTAL", "RANK", "LEVEL"}:
            break
        if not is_int_token(lines[index]) or not is_int_token(lines[index + 1]):
            index += 1
            continue
        label = lines[index + 2]
        stat_id = "body" if "body" in label.lower() else "mind" if "mind" in label.lower() else "soul" if "soul" in label.lower() else None
        value = int(lines[index])
        stats.append({"name": label, "value": value, "points": int(lines[index + 1]), "statId": stat_id})
        if stat_id:
            totals[stat_id] += value
        index += 3
    return stats, totals


def parse_derived_table(lines: list[str]) -> dict[str, int]:
    if "DERIVED VALUE" not in lines:
        return {}
    derived: dict[str, int] = {}
    index = lines.index("DERIVED VALUE") + 1
    while index + 1 < len(lines):
        if lines[index] in {"ATTRIBUTE", "DEFECT", "TOTAL", "RANK", "LEVEL"}:
            break
        if not is_int_token(lines[index]):
            index += 1
            continue
        key = normalize_key(re.sub(r"\(.*\)", "", lines[index + 1])).replace(" ", "-")
        derived[key] = int(lines[index])
        index += 2
    return derived


def parse_component_table(lines: list[str], marker: str, kind: str, lookup: list[tuple[str, str, str]]) -> list[dict]:
    if marker not in lines:
        return []
    components: list[dict] = []
    index = lines.index(marker) + 1
    while index < len(lines):
        if lines[index] in {"ATTRIBUTE", "DEFECT", "DERIVED VALUE", "TOTAL", "RANK", "LEVEL", "POINTS", "STAT"}:
            break
        if not is_value_token(lines[index]) or index + 1 >= len(lines) or not is_int_token(lines[index + 1]):
            index += 1
            continue
        value_text = lines[index]
        points = int(lines[index + 1])
        index += 2
        label_parts: list[str] = []
        while index < len(lines) and lines[index] not in {"ATTRIBUTE", "DEFECT", "DERIVED VALUE", "TOTAL", "RANK", "LEVEL", "POINTS", "STAT"} and not is_value_token(lines[index]):
            label_parts.append(lines[index])
            index += 1
        label = collapse_space(" ".join(label_parts))
        if not label:
            continue
        catalog_id, catalog_name = resolve_catalog_id(label, lookup)
        component = {"label": label, "name": label, "catalogId": catalog_id, "specialization": extract_specialization(label, catalog_name), "points": points}
        if kind == "attribute":
            component["level"] = parse_primary_number(value_text)
            component["levelText"] = value_text
        else:
            component["rank"] = parse_primary_number(value_text, 1)
            component["rankText"] = value_text
        components.append(component)
    return components


def parse_size_rank(lines: list[str]) -> int:
    for line in lines:
        match = re.search(r"Size Rank\s+(-?\d+)", line)
        if match:
            return int(match.group(1))
    return 0


def merge_overrides(payload: object, override: object) -> object:
    if isinstance(payload, dict) and isinstance(override, dict):
        merged = dict(payload)
        for key, value in override.items():
            merged[key] = merge_overrides(merged.get(key), value)
        return merged
    return override


def apply_entry_overrides(entries: list[dict], override_group: dict[str, dict]) -> list[dict]:
    return [merge_overrides(entry, override_group[entry["id"]]) if entry["id"] in override_group else entry for entry in entries]


def build_template_structures(text_pages: dict[int, list[str]], attribute_entries: list[dict], defect_entries: list[dict]) -> dict:
    attribute_lookup = build_lookup(attribute_entries)
    defect_lookup = build_lookup(defect_entries)
    template_index = load_json(TEMPLATES_PATH, {})
    result = {"race": [], "class": []}
    for group_name in ("race", "class"):
        entries = template_index[group_name]
        for index, entry in enumerate(entries):
            next_entry = entries[index + 1] if index + 1 < len(entries) else None
            page_limit = max(entry["page"] + 1, next_entry["page"] if next_entry else entry["page"] + 1)
            lines: list[str] = []
            for page in range(entry["page"], page_limit + 1):
                lines.extend(text_pages.get(page, []))
            matches = find_indices(lines, entry["name"])
            table_matches = [match for match in matches if any(token in {"LEVEL", "VALUE"} or "Size Rank" in token for token in lines[match + 1:match + 6])]
            table_start = table_matches[-1] if table_matches else (matches[-1] if matches else 0)
            total_index = next((i for i in range(table_start, len(lines)) if lines[i] == "TOTAL"), len(lines) - 1)
            section_start = matches[0] if matches else table_start
            table_lines = lines[table_start:total_index + 1]
            stats, stat_totals = parse_stat_table(table_lines)
            template = {
                **entry,
                "type": group_name,
                "sourcePage": entry["page"],
                "rulesText": "\n".join(lines[section_start:total_index + 1]).strip(),
                "notesText": "\n".join(lines[section_start + 1:table_start]).strip(),
                "sizeRank": parse_size_rank(table_lines),
                "stats": stats,
                "body": stat_totals["body"],
                "mind": stat_totals["mind"],
                "soul": stat_totals["soul"],
                "attributes": parse_component_table(table_lines, "ATTRIBUTE", "attribute", attribute_lookup),
                "defects": parse_component_table(table_lines, "DEFECT", "defect", defect_lookup),
                "parsedTotalPoints": extract_total_points(table_lines),
            }
            result[group_name].append(template)
    result["all"] = sorted(result["race"] + result["class"], key=lambda item: (item["type"], item["page"], item["name"]))
    return result


def split_section(lines: list[str], heading: str, next_headings: list[str]) -> list[str]:
    try:
        start = lines.index(heading)
    except ValueError:
        return []
    end = len(lines)
    for candidate in next_headings:
        try:
            end = min(end, lines.index(candidate, start + 1))
        except ValueError:
            pass
    try:
        header_end = lines.index("Item Cost", start, end) + 1
    except ValueError:
        header_end = start + 1
    for footer_index in range(header_end, end):
        if re.fullmatch(r"\d{2}: [A-Z]+", lines[footer_index]) or lines[footer_index] == "PAGE":
            end = footer_index
            break
    return lines[header_end:end]


def is_point_cost_token(value: str) -> bool:
    return bool(re.fullmatch(r"-|\d+", value))


def looks_like_blueprint_name(value: str, section_names: list[str]) -> bool:
    if not value or value in section_names:
        return False
    if value in {"Level", "Enhancements", "Limiters", "Points", "Item Cost", "Attribute", "AR", "Modifiers"}:
        return False
    if is_value_token(value) or is_point_cost_token(value):
        return False
    return True


def build_modifier_entries(raw_modifiers: dict) -> list[dict]:
    entries: list[dict] = []
    for group in raw_modifiers.values():
        if not isinstance(group, list):
            continue
        for entry in group:
            if not isinstance(entry, dict):
                continue
            entries.append({"id": entry["id"], "name": entry["name"], "kind": entry["kind"]})
    return entries


def line_starts_with_modifier(line: str, entries: list[dict]) -> bool:
    normalized = normalize_key(line)
    return any(normalized.startswith(normalize_key(entry["name"])) for entry in entries)


def parse_modifier_assignments(text: str, entries: list[dict]) -> list[dict]:
    result: dict[str, dict] = {}
    if not text:
        return []
    lookup = sorted(
        [{"id": entry["id"], "name": entry["name"], "kind": entry["kind"], "key": normalize_key(entry["name"])} for entry in entries],
        key=lambda entry: len(entry["key"]),
        reverse=True,
    )
    for chunk in [piece.strip() for piece in re.split(r"[,+;\n]", text.replace("(", " ").replace(")", " ")) if piece.strip() and piece.strip() != "-"]:
        normalized = normalize_key(chunk)
        match = next((entry for entry in lookup if normalized.startswith(entry["key"])), None)
        if not match:
            continue
        amount_match = re.search(r"-?\d+", normalized[len(match["key"]):])
        assignments = max(abs(int(amount_match.group(0))) if amount_match else 1, 1)
        current = result.setdefault(match["id"], {"id": match["id"], "name": match["name"], "kind": match["kind"], "assignments": 0})
        current["assignments"] += assignments
    return list(result.values())


def split_weapon_modifier_lines(lines: list[str], enhancement_entries: list[dict], limiter_entries: list[dict]) -> tuple[str, str]:
    if not lines:
        return "-", "-"
    if len(lines) == 1:
        line = lines[0]
        if line == "-":
            return "-", "-"
        if line_starts_with_modifier(line, limiter_entries):
            return "-", line
        return line, "-"

    enhancement_lines: list[str] = []
    limiter_lines: list[str] = []
    for line in lines:
        if limiter_lines:
            limiter_lines.append(line)
            continue
        if enhancement_lines and line_starts_with_modifier(line, limiter_entries):
            limiter_lines.append(line)
            continue
        enhancement_lines.append(line)

    if not limiter_lines:
        if enhancement_lines and enhancement_lines[0] == "-" and len(enhancement_lines) > 1:
            limiter_lines = enhancement_lines[1:]
            enhancement_lines = enhancement_lines[:1]
        elif enhancement_lines and line_starts_with_modifier(enhancement_lines[0], limiter_entries):
            limiter_lines = enhancement_lines
            enhancement_lines = ["-"]
        else:
            limiter_lines = ["-"]

    enhancements_text = collapse_space(" ".join(enhancement_lines)) or "-"
    limiters_text = collapse_space(" ".join(limiter_lines)) or "-"
    return enhancements_text, limiters_text


def split_trailing_cost_tokens(tokens: list[str]) -> tuple[list[str], int, int]:
    row_tokens = list(tokens)
    trailing: list[str] = []
    while row_tokens and is_point_cost_token(row_tokens[-1]):
        trailing.insert(0, row_tokens.pop())
    actual = trailing[:2] if len(trailing) > 2 else trailing
    points = 0
    item_cost = 0
    if len(actual) == 2:
        points = 0 if actual[0] == "-" else parse_primary_number(actual[0])
        item_cost = 0 if actual[1] == "-" else parse_primary_number(actual[1])
    elif len(actual) == 1:
        points = 0 if actual[0] == "-" else parse_primary_number(actual[0])
    return row_tokens, points, item_cost


def looks_like_armour_attribute(value: str) -> bool:
    return normalize_key(value) in {"features", "armour", "force field"}


def looks_like_armour_row_start(lines: list[str], index: int, section_names: list[str]) -> bool:
    if index + 2 >= len(lines):
        return False
    return looks_like_blueprint_name(lines[index], section_names) and looks_like_armour_attribute(lines[index + 1]) and is_value_token(lines[index + 2])


def looks_like_weapon_row_start(lines: list[str], index: int, section_names: list[str], modifier_entries: list[dict]) -> bool:
    if index + 1 >= len(lines):
        return False
    if not (looks_like_blueprint_name(lines[index], section_names) and is_value_token(lines[index + 1])):
        return False
    return not line_starts_with_modifier(lines[index], modifier_entries)


def parse_weapon_blueprints(text_pages: dict[int, list[str]], modifier_entries: list[dict]) -> list[dict]:
    entries: list[dict] = []
    section_names = [spec["category"] for spec in WEAPON_TABLE_SPECS]
    enhancement_entries = [entry for entry in modifier_entries if entry["kind"] == "enhancement"]
    limiter_entries = [entry for entry in modifier_entries if entry["kind"] == "limiter"]
    for spec in WEAPON_TABLE_SPECS:
        lines = split_section(text_pages.get(spec["page"], []), spec["category"], section_names)
        index = 0
        while index + 1 < len(lines):
            name = lines[index]
            if not looks_like_blueprint_name(name, section_names):
                index += 1
                continue
            level_text = lines[index + 1]
            if not is_value_token(level_text):
                index += 1
                continue
            cursor = index + 2
            row_tokens: list[str] = []
            while cursor < len(lines):
                if looks_like_weapon_row_start(lines, cursor, section_names, modifier_entries):
                    break
                row_tokens.append(lines[cursor])
                cursor += 1
            modifier_lines, points, item_cost = split_trailing_cost_tokens(row_tokens)
            enhancements_text, limiters_text = split_weapon_modifier_lines(modifier_lines, enhancement_entries, limiter_entries)
            enhancements = parse_modifier_assignments(enhancements_text, enhancement_entries)
            limiters = parse_modifier_assignments(limiters_text, limiter_entries)
            range_rank = next((modifier["assignments"] for modifier in enhancements if modifier["id"] == "range"), 0)
            muscle_powered = any(modifier["id"] == "muscle" for modifier in enhancements)
            entries.append({
                "id": slugify(f"{spec['category']}-{name}"),
                "name": name,
                "kind": "weapon",
                "itemType": "attribute",
                "catalogId": "weapon",
                "category": spec["category"],
                "sourcePage": spec["page"],
                "attackMode": spec["attackMode"],
                "levelText": level_text,
                "level": parse_primary_number(level_text),
                "points": points,
                "itemCost": item_cost,
                "enhancementsText": enhancements_text,
                "limitersText": limiters_text,
                "enhancements": enhancements,
                "limiters": limiters,
                "detailsText": collapse_space(" ".join(value for value in [enhancements_text if enhancements_text != "-" else "", limiters_text if limiters_text != "-" else ""] if value)),
                "rangeRank": range_rank,
                "musclePowered": muscle_powered,
                "rulesText": f"{name}\nLevel: {level_text}\nEnhancements: {enhancements_text}\nLimiters: {limiters_text}\nPoints: {points}\nItem Cost: {item_cost}",
            })
            index = cursor
    return entries


def parse_armour_blueprints(text_pages: dict[int, list[str]], modifier_entries: list[dict]) -> list[dict]:
    entries: list[dict] = []
    section_names = [spec["category"] for spec in ARMOUR_TABLE_SPECS]
    for spec in ARMOUR_TABLE_SPECS:
        lines = split_section(text_pages.get(spec["page"], []), spec["category"], section_names)
        index = 0
        while index + 5 < len(lines):
            name = lines[index]
            if not looks_like_blueprint_name(name, section_names):
                index += 1
                continue
            attribute_name = lines[index + 1]
            level_text = lines[index + 2]
            if not is_value_token(level_text):
                index += 1
                continue
            armour_rating = parse_primary_number(lines[index + 3])
            cursor = index + 4
            row_tokens: list[str] = []
            while cursor < len(lines):
                if looks_like_armour_row_start(lines, cursor, section_names):
                    break
                row_tokens.append(lines[cursor])
                cursor += 1
            modifier_lines, points, item_cost = split_trailing_cost_tokens(row_tokens)
            modifiers_text = collapse_space(" ".join(modifier_lines)) or "-"
            modifiers = parse_modifier_assignments(modifiers_text, modifier_entries)
            catalog_id = "force-field" if "Force Field" in attribute_name else "armour" if "Armour" in attribute_name else "features"
            entries.append({
                "id": slugify(f"{spec['category']}-{name}"),
                "name": f"{spec['category']}: {name}",
                "kind": "defence",
                "itemType": "attribute",
                "catalogId": catalog_id,
                "category": spec["category"],
                "sourcePage": spec["page"],
                "levelText": level_text,
                "level": parse_primary_number(level_text),
                "armourRating": armour_rating,
                "points": points,
                "itemCost": item_cost,
                "modifiersText": modifiers_text,
                "mods": modifiers,
                "detailsText": modifiers_text,
                "rulesText": f"{name}\nAttribute: {attribute_name}\nLevel: {level_text}\nArmour Rating: {armour_rating}\nModifiers: {modifiers_text}\nPoints: {points}\nItem Cost: {item_cost}",
            })
            index = cursor
    return entries


def parse_companions(text_pages: dict[int, list[str]], attribute_entries: list[dict], defect_entries: list[dict]) -> list[dict]:
    attribute_lookup = build_lookup(attribute_entries)
    defect_lookup = build_lookup(defect_entries)
    all_lines: list[tuple[int, str]] = []
    for page in range(230, 258):
        for line in text_pages.get(page, []):
            all_lines.append((page, line))
    entries: list[dict] = []
    index = 0
    while index + 2 < len(all_lines):
        page, line = all_lines[index]
        if normalize_key(line) == normalize_key(all_lines[index + 1][1]) and any("Size Rank" in value for _, value in all_lines[index + 1:index + 12]):
            end = index + 1
            while end < len(all_lines) and all_lines[end][1] != "TOTAL":
                end += 1
            if end >= len(all_lines):
                break
            lines = [value for _, value in all_lines[index:end + 1]]
            stats, _ = parse_stat_table(lines)
            entries.append({
                "id": slugify(line),
                "name": line,
                "sourcePage": page,
                "sizeRank": parse_size_rank(lines),
                "stats": {entry["statId"]: entry["value"] for entry in stats if entry["statId"]},
                "statTable": stats,
                "derived": parse_derived_table(lines),
                "attributes": parse_component_table(lines, "ATTRIBUTE", "attribute", attribute_lookup),
                "defects": parse_component_table(lines, "DEFECT", "defect", defect_lookup),
                "totalPoints": extract_total_points(lines),
                "rulesText": "\n".join(lines).strip(),
                "notesText": "",
                "variant": "battle" if " - BATTLE" in line else "pet" if " - PET" in line else "standard",
            })
            index = end + 1
            continue
        index += 1
    return entries


def build_reference_data(blocks_by_page: dict[int, list[str]]) -> dict:
    return {
        "stats": SEED_REFERENCE.get("stats", {}),
        "powerLevels": POWER_LEVELS,
        "powerLevelRulesText": extract_span(blocks_by_page, 22, 23),
        "benchmarks": load_json(BENCHMARKS_PATH, {}),
        "targetNumbers": TARGET_NUMBERS,
        "sizeRanks": SIZE_RANKS,
        "skillGroups": SKILL_GROUPS,
        "referenceTables": [{**spec, "sourcePage": spec["startPage"], "rulesText": extract_section(blocks_by_page, spec["heading"], spec["startPage"], spec["endPage"])} for spec in REFERENCE_TABLE_SPECS],
    }


def build_item_library(blocks_by_page: dict[int, list[str]]) -> dict:
    return {"sections": [{**spec, "sourcePage": spec["startPage"], "rulesText": extract_section(blocks_by_page, spec["heading"], spec["startPage"], spec["endPage"])} for spec in ITEM_SECTION_SPECS]}


def build_coverage(attributes: list[dict], defects: list[dict], modifiers: dict, templates: dict, reference_data: dict, item_library: dict, item_blueprints: list[dict], companions: list[dict]) -> dict:
    return {
        "book": {"title": "BESM 4e Core Rulebook 4th Edition", "pdfPageOffset": PRINTED_PAGE_OFFSET},
        "counts": {
            "attributes": len(attributes),
            "defects": len(defects),
            "templates": len(templates["all"]),
            "modifiers": sum(len(group) for group in modifiers.values() if isinstance(group, list)),
            "referenceTables": len(reference_data["referenceTables"]),
            "itemSections": len(item_library["sections"]),
            "itemBlueprints": len(item_blueprints),
            "companions": len(companions),
        },
    }


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    block_pages = load_clean_pages()
    text_pages = load_text_pages()
    overrides = load_json(OVERRIDES_PATH, {})
    raw_modifiers = load_json(MODIFIERS_PATH, {})
    modifier_entries = build_modifier_entries(raw_modifiers)
    attributes = apply_entry_overrides(attach_rules_text(parse_catalog_entries("ATTRIBUTE_CATALOG"), block_pages, end_page_limit=132), overrides.get("attributes", {}))
    defects = apply_entry_overrides(attach_rules_text(parse_catalog_entries("DEFECT_CATALOG"), block_pages, end_page_limit=167), overrides.get("defects", {}))
    modifiers = {group: apply_entry_overrides(enrich_modifier_group(entries, block_pages), overrides.get("modifiers", {}).get(group, {})) for group, entries in raw_modifiers.items() if isinstance(entries, list)}
    templates = build_template_structures(text_pages, attributes, defects)
    templates["race"] = apply_entry_overrides(templates["race"], overrides.get("templates", {}).get("race", {}))
    templates["class"] = apply_entry_overrides(templates["class"], overrides.get("templates", {}).get("class", {}))
    templates["all"] = sorted(templates["race"] + templates["class"], key=lambda item: (item["type"], item["page"], item["name"]))
    item_blueprints = apply_entry_overrides(parse_weapon_blueprints(text_pages, modifier_entries) + parse_armour_blueprints(text_pages, modifier_entries), overrides.get("itemBlueprints", {}))
    companions = apply_entry_overrides(parse_companions(text_pages, attributes, defects), overrides.get("companions", {}))
    reference_data = build_reference_data(block_pages)
    item_library = merge_overrides(build_item_library(block_pages), overrides.get("itemLibrary", {}))
    coverage = build_coverage(attributes, defects, modifiers, templates, reference_data, item_library, item_blueprints, companions)
    write_json(DATA_DIR / "attributes.json", {"entries": attributes})
    write_json(DATA_DIR / "defects.json", {"entries": defects})
    write_json(DATA_DIR / "modifiers.json", modifiers)
    write_json(DATA_DIR / "templates.json", templates)
    write_json(DATA_DIR / "reference-data.json", reference_data)
    write_json(DATA_DIR / "item-library.json", item_library)
    write_json(DATA_DIR / "item-blueprints.json", {"entries": item_blueprints})
    write_json(DATA_DIR / "companions.json", {"entries": companions})
    write_json(DATA_DIR / "coverage.json", coverage)


if __name__ == "__main__":
    main()
