"""Parse and validate AGENT_VERSION without shell-escaping Python code."""
import ast
import re
import sys
from pathlib import Path

def app_version(path="gui.py"):
    tree = ast.parse(Path(path).read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "AGENT_VERSION"
            for target in node.targets
        ):
            if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                version = node.value.value
                if re.fullmatch(r"\d+\.\d+\.\d+", version):
                    return version
    raise ValueError("AGENT_VERSION must be a semantic version X.Y.Z")

if __name__ == "__main__":
    version = app_version()
    if len(sys.argv) == 3 and sys.argv[1] == "--expect-tag":
        expected_tag = "radio-agent-v" + version
        if sys.argv[2] != expected_tag:
            raise SystemExit(f"Release tag mismatch: expected {expected_tag}, got {sys.argv[2]}")
    print(version)
