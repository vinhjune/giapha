#!/usr/bin/env python3
"""Validate installed AgentKit skill references from the live skill tree.

The script discovers skills and aliases from current ``SKILL.md`` files. It
does not carry a production skill inventory or expected workflow chain.

Usage:
  python3 validate-skill-crossrefs.py <skills-dir>
  python3 validate-skill-crossrefs.py <skills-dir> --json
  python3 validate-skill-crossrefs.py --self-test
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
CODE_FENCE_RE = re.compile(r"```[\s\S]*?```", re.MULTILINE)
BODY_REF_RE = re.compile(r"/ak:([a-z0-9][a-z0-9-]*)")
NAME_RE = re.compile(r"^name:\s*[\"']?([^\"'\n]+)[\"']?\s*$", re.MULTILINE)
LIST_FIELD_RE = re.compile(r"^(requires|related):\s*\[(.*?)\]\s*$", re.MULTILINE)
SKIP_PARTS = frozenset({".git", ".venv", "node_modules", "__pycache__"})


def _frontmatter(content: str) -> str:
    match = FRONTMATTER_RE.match(content)
    return match.group(1) if match else ""


def _frontmatter_name(content: str, fallback: str) -> str:
    match = NAME_RE.search(_frontmatter(content))
    return match.group(1).strip() if match else fallback


def _metadata_refs(content: str) -> set[str]:
    refs: set[str] = set()
    for match in LIST_FIELD_RE.finditer(_frontmatter(content)):
        for raw in match.group(2).split(","):
            value = raw.strip().strip("'\"")
            if value:
                refs.add(value.rsplit(":", 1)[-1].removeprefix("ak-"))
    return refs


def _body_refs(content: str) -> set[str]:
    body_match = FRONTMATTER_RE.match(content)
    body = content[body_match.end():] if body_match else content
    return set(BODY_REF_RE.findall(CODE_FENCE_RE.sub("", body)))


def _aliases(relative_dir: str, name: str) -> set[str]:
    leaf = relative_dir.rsplit("/", 1)[-1]
    return {
        relative_dir,
        leaf,
        leaf.removeprefix("ak-"),
        name,
        name.rsplit(":", 1)[-1],
        name.rsplit(":", 1)[-1].removeprefix("ak-"),
    }


def scan_skills(skills_dir: Path) -> dict[str, dict[str, object]]:
    """Return the discovered skill nodes keyed by repository-relative folder."""
    skills: dict[str, dict[str, object]] = {}
    for skill_file in sorted(skills_dir.rglob("SKILL.md")):
        relative = skill_file.relative_to(skills_dir)
        if skill_file.is_symlink() or any(part in SKIP_PARTS for part in relative.parts):
            continue
        key = relative.parent.as_posix()
        content = skill_file.read_text(encoding="utf-8", errors="replace")
        name = _frontmatter_name(content, relative.parent.name)
        skills[key] = {
            "name": name,
            "aliases": _aliases(key, name),
            "refs": _body_refs(content) | _metadata_refs(content),
        }
    return skills


def validate_references(skills: dict[str, dict[str, object]]) -> dict[str, object]:
    alias_owners: dict[str, set[str]] = {}
    for key, data in skills.items():
        for alias in data["aliases"]:  # type: ignore[union-attr]
            alias_owners.setdefault(str(alias), set()).add(key)

    ambiguous = {
        alias: sorted(owners)
        for alias, owners in alias_owners.items()
        if len(owners) > 1
    }
    edges: dict[str, list[str]] = {}
    broken: list[dict[str, str]] = []
    for key, data in skills.items():
        targets: set[str] = set()
        own_aliases = data["aliases"]
        for ref in data["refs"]:  # type: ignore[union-attr]
            normalized = str(ref).removeprefix("ak-")
            if normalized in own_aliases:
                continue
            owners = alias_owners.get(normalized, set()) | alias_owners.get(str(ref), set())
            if not owners:
                broken.append({"from": key, "ref": str(ref)})
                continue
            targets.update(owners - {key})
        if targets:
            edges[key] = sorted(targets)

    return {
        "skills": len(skills),
        "edges": edges,
        "broken": broken,
        "ambiguous_aliases": ambiguous,
    }


def print_report(result: dict[str, object]) -> None:
    print("Skill cross-reference audit")
    print(f"Skills discovered: {result['skills']}")
    print(f"Skills with outward references: {len(result['edges'])}")
    print(f"Broken references: {len(result['broken'])}")
    print(f"Ambiguous aliases: {len(result['ambiguous_aliases'])}")
    for item in result["broken"]:  # type: ignore[union-attr]
        print(f"  {item['from']} -> /ak:{item['ref']}")
    for alias, owners in result["ambiguous_aliases"].items():  # type: ignore[union-attr]
        print(f"  alias {alias}: {', '.join(owners)}")


def self_test() -> None:
    with tempfile.TemporaryDirectory() as raw:
        root = Path(raw)
        fixtures = {
            "ak-build": "---\nname: ak:build\nrelated: [ak:review]\n---\nRun /ak:review.\n",
            "ak-review": "---\nname: ak:review\n---\nReview output.\n```\n/ak:not-real\n```\n",
            "ak-broken": "---\nname: ak:broken\n---\nRun /ak:missing.\n",
        }
        for name, content in fixtures.items():
            folder = root / name
            folder.mkdir()
            (folder / "SKILL.md").write_text(content, encoding="utf-8")
        result = validate_references(scan_skills(root))
        assert result["skills"] == len(fixtures)
        assert result["edges"] == {"ak-build": ["ak-review"]}
        assert result["broken"] == [{"from": "ak-broken", "ref": "missing"}]
        assert result["ambiguous_aliases"] == {}
    print("[OK] source-derived cross-reference self-test")


def main() -> None:
    if "--self-test" in sys.argv:
        self_test()
        return
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    if len(args) != 1:
        raise SystemExit("Usage: validate-skill-crossrefs.py <skills-dir> [--json]")
    skills_dir = Path(args[0])
    if not skills_dir.is_dir():
        raise SystemExit(f"Error: {skills_dir} is not a directory")
    result = validate_references(scan_skills(skills_dir))
    if "--json" in sys.argv:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print_report(result)
    if result["broken"] or result["ambiguous_aliases"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
