#!/usr/bin/env python3
"""Build a directed tool-to-tool adjacency matrix from a tool-level Mermaid graph.

Inputs:
- Tool-level Mermaid graph (.mmd) with node labels (tool names) and directed edges

Outputs:
- JSON adjacency artifact
- CSV adjacency matrix

Usage:
    # Auto-discover files from a modality's connects directory:
    python build_tool_adjacency.py --connects-dir ../fmri_tests/connects

    # Or specify the graph file explicitly:
    python build_tool_adjacency.py --graph ../fmri_tests/connects/fmri_tool_graph.mmd
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple


NODE_RE = re.compile(r'^\s*([A-Za-z0-9_]+)\s*\["([^"]+)"\]\s*$')
EDGE_RE = re.compile(r"^\s*([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)\s*$")


def parse_tool_graph(
    graph_path: Path,
) -> Tuple[Dict[str, str], Set[Tuple[str, str]]]:
    """Parse a tool-level Mermaid graph.

    Returns:
        node_id_to_label: mapping from sanitized node IDs to tool names
        tool_edges: set of (source_tool_name, target_tool_name) pairs
    """
    if not graph_path.exists():
        raise FileNotFoundError(f"Graph file not found: {graph_path}")

    node_id_to_label: Dict[str, str] = {}
    directed_edges_by_id: Set[Tuple[str, str]] = set()

    for lineno, line in enumerate(graph_path.read_text(encoding="utf-8").splitlines(), start=1):
        node_match = NODE_RE.match(line)
        if node_match:
            node_id, label = node_match.groups()
            existing = node_id_to_label.get(node_id)
            if existing is not None and existing != label:
                raise ValueError(
                    f"Conflicting node label for ID '{node_id}' in {graph_path}:{lineno}: "
                    f"'{existing}' vs '{label}'"
                )
            node_id_to_label[node_id] = label
            continue

        edge_match = EDGE_RE.match(line)
        if edge_match:
            src_id, dst_id = edge_match.groups()
            directed_edges_by_id.add((src_id, dst_id))

    if not node_id_to_label:
        raise ValueError(f"No Mermaid nodes found in graph file: {graph_path}")
    if not directed_edges_by_id:
        raise ValueError(f"No Mermaid directed edges found in graph file: {graph_path}")

    missing_node_refs = [
        (src, dst)
        for src, dst in directed_edges_by_id
        if src not in node_id_to_label or dst not in node_id_to_label
    ]
    if missing_node_refs:
        raise ValueError(
            "Graph contains edges referencing undefined node IDs: "
            + ", ".join([f"{src}->{dst}" for src, dst in sorted(missing_node_refs)])
        )

    # Map edge IDs to tool names (labels)
    tool_edges: Set[Tuple[str, str]] = set()
    for src_id, dst_id in directed_edges_by_id:
        tool_edges.add((node_id_to_label[src_id], node_id_to_label[dst_id]))

    return node_id_to_label, tool_edges


def build_matrix(
    tool_order: List[str],
    tool_edges: Set[Tuple[str, str]],
) -> List[List[int]]:
    """Build a binary adjacency matrix from direct tool-to-tool edges."""
    matrix: List[List[int]] = []
    for src_tool in tool_order:
        row: List[int] = []
        for dst_tool in tool_order:
            row.append(1 if (src_tool, dst_tool) in tool_edges else 0)
        matrix.append(row)
    return matrix


def write_csv_matrix(csv_path: Path, tool_order: List[str], matrix: List[List[int]]) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["tool", *tool_order])
        for tool_name, row in zip(tool_order, matrix):
            writer.writerow([tool_name, *row])


def _discover_modality_files(connects_dir: Path) -> Tuple[Path, str]:
    """Discover the tool graph file in a connects directory.

    Expects files matching:
        {modality}_tool_graph.mmd
    """
    graphs = sorted(connects_dir.glob("*_tool_graph.mmd"))

    if len(graphs) != 1:
        raise FileNotFoundError(
            f"Expected exactly 1 *_tool_graph.mmd in {connects_dir}, found {len(graphs)}: "
            + ", ".join(p.name for p in graphs)
        )

    graph_path = graphs[0]

    # Derive modality key from the graph filename
    stem = graph_path.stem
    suffix = "_tool_graph"
    if stem.endswith(suffix):
        modality_key = stem[: -len(suffix)]
    else:
        modality_key = stem

    return graph_path, modality_key


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a directed tool adjacency matrix from a tool-level Mermaid graph."
    )
    parser.add_argument(
        "--connects-dir",
        type=Path,
        default=None,
        help=(
            "Path to a modality's connects directory. Auto-discovers the graph file. "
            "Mutually exclusive with --graph."
        ),
    )
    parser.add_argument(
        "--graph",
        type=Path,
        default=None,
        help="Path to tool-level Mermaid graph (.mmd).",
    )
    parser.add_argument(
        "--out-json",
        type=Path,
        default=None,
        help="Output path for JSON matrix artifact (default: auto-derived from modality).",
    )
    parser.add_argument(
        "--out-csv",
        type=Path,
        default=None,
        help="Output path for CSV matrix artifact (default: auto-derived from modality).",
    )
    return parser.parse_args(list(argv))


def _resolve_paths(
    args: argparse.Namespace,
) -> Tuple[Path, Path, Path]:
    """Resolve graph and output paths from CLI arguments."""
    graph_path: Optional[Path] = args.graph
    out_json: Optional[Path] = args.out_json
    out_csv: Optional[Path] = args.out_csv

    if args.connects_dir is not None:
        connects_dir = args.connects_dir.resolve()
        if not connects_dir.is_dir():
            raise FileNotFoundError(f"--connects-dir is not a directory: {connects_dir}")

        discovered_graph, modality_key = _discover_modality_files(connects_dir)

        graph_path = graph_path or discovered_graph
        out_json = out_json or (connects_dir / f"{modality_key}_tool_adjacency_matrix.json")
        out_csv = out_csv or (connects_dir / f"{modality_key}_tool_adjacency_matrix.csv")

    if graph_path is None:
        raise ValueError(
            "Must provide either --connects-dir or --graph."
        )

    # Default output paths next to the graph file
    if out_json is None:
        out_json = graph_path.parent / (graph_path.stem.replace("_tool_graph", "") + "_tool_adjacency_matrix.json")
    if out_csv is None:
        out_csv = graph_path.parent / (graph_path.stem.replace("_tool_graph", "") + "_tool_adjacency_matrix.csv")

    return graph_path.resolve(), out_json.resolve(), out_csv.resolve()


def main(argv: Iterable[str]) -> int:
    args = parse_args(argv)
    graph_path, out_json_path, out_csv_path = _resolve_paths(args)

    node_id_to_label, tool_edges = parse_tool_graph(graph_path)

    tool_order = sorted(set(node_id_to_label.values()))
    if not tool_order:
        raise ValueError("No tools found in graph file after parsing.")

    tool_to_index = {tool_name: idx for idx, tool_name in enumerate(tool_order)}
    matrix = build_matrix(tool_order, tool_edges)
    edge_count = sum(sum(row) for row in matrix)

    # Sorted edge list for the JSON artifact
    tool_edges_for_output = [
        {"source": src, "target": dst}
        for src, dst in sorted(tool_edges)
    ]

    payload = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "sources": {
            "graph": str(graph_path),
        },
        "toolOrder": tool_order,
        "toolToIndex": tool_to_index,
        "toolEdges": tool_edges_for_output,
        "matrix": matrix,
        "edgeCount": edge_count,
        "toolCount": len(tool_order),
    }

    out_json_path.parent.mkdir(parents=True, exist_ok=True)
    out_json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    write_csv_matrix(out_csv_path, tool_order, matrix)

    print("Built directed tool adjacency matrix.")
    print(f"  tools: {len(tool_order)}")
    print(f"  graph nodes: {len(node_id_to_label)}")
    print(f"  tool directed edges (matrix 1s): {edge_count}")
    print(f"  json: {out_json_path}")
    print(f"  csv:  {out_csv_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as exc:  # noqa: BLE001 - CLI error reporting
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
