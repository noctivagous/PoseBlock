#!/usr/bin/env python3
"""
Patch a local sam-3d-body clone for CPU/MPS inference.

The upstream estimator hardcodes recursive_to(batch, "cuda"). This replaces it
with the model's actual device so Mac (mps) and CPU runs work.
"""

from __future__ import annotations

import sys
from pathlib import Path


def patch_estimator(sam3d_root: Path) -> bool:
    estimator_py = sam3d_root / "sam_3d_body" / "sam_3d_body_estimator.py"
    if not estimator_py.is_file():
        print(f"ERROR: not found: {estimator_py}")
        return False

    text = estimator_py.read_text()
    marker = "device = next(self.model.parameters()).device"
    if marker in text:
        print("sam_3d_body_estimator.py already patched.")
        return True

    old = "        batch = recursive_to(batch, \"cuda\")"
    new = (
        "        device = next(self.model.parameters()).device\n"
        "        batch = recursive_to(batch, device)"
    )
    if old not in text:
        print("WARNING: could not find hardcoded cuda line to patch.")
        print("         Check sam-3d-body version — patch may need updating.")
        return False

    estimator_py.write_text(text.replace(old, new, 1))
    print(f"Patched {estimator_py}")
    return True


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: patch_sam3d_body.py /path/to/sam-3d-body")
        sys.exit(1)
    ok = patch_estimator(Path(sys.argv[1]).resolve())
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
