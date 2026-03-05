import pathlib

spec_path = pathlib.Path(__file__).resolve().parent / "MarkGraph.md"

MARKGRAPH_SPEC = spec_path.read_text(encoding="utf-8")