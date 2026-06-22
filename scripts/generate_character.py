#!/usr/bin/env python3
"""
Generate a 3D human mesh from a photo using SAM 3D Body via Hugging Face Spaces.

Prerequisites:
  pip install -r scripts/requirements.txt
  export HF_TOKEN=hf_...   # read token from https://huggingface.co/settings/tokens
  Accept license: https://huggingface.co/facebook/sam-3d-body-dinov3

Usage:
  python scripts/generate_character.py photo.jpg --name teen_f
  python scripts/generate_character.py photo.jpg --name teen_f --space akhaliq/sam-3d-body
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

DEFAULT_SPACES = [
    "dev-bjoern/sam-3d-body-mcp",
    "akhaliq/sam-3d-body",
    "iAkashPaul/sam-3d-body",
]

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "assets" / "raw"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SAM 3D Body → MHR GLB via HF Space")
    parser.add_argument("image", type=Path, help="Full-body photo (JPG/PNG)")
    parser.add_argument("--name", default="character", help="Output basename (e.g. teen_f)")
    parser.add_argument(
        "--space",
        default=None,
        help="HF Space id (owner/name). Tries defaults if omitted.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output path (default: assets/raw/{name}_mhr.glb)",
    )
    return parser.parse_args()


def try_space(space_id: str, image: Path, hf_token: str | None) -> Path | None:
    from gradio_client import Client, handle_file

    print(f"Trying Space: {space_id}")
    client = Client(space_id, hf_token=hf_token)

    # Discover API — Spaces vary; try common input names.
    api_info = client.view_api(all_endpoints=True)
    print(api_info)

    image_file = handle_file(str(image))

    candidates = [
        {"image": image_file},
        {"input_image": image_file},
        {"file": image_file},
        {"photo": image_file},
    ]

    for payload in candidates:
        try:
            result = client.predict(**payload, api_name="/predict")
            path = extract_glb_path(result)
            if path:
                return path
        except Exception as exc:
            print(f"  predict failed ({list(payload.keys())[0]}): {exc}")

    # Some Spaces expose named endpoints
    for endpoint in ("/generate", "/run", "/infer"):
        try:
            result = client.predict(image_file, api_name=endpoint)
            path = extract_glb_path(result)
            if path:
                return path
        except Exception:
            pass

    return None


def extract_glb_path(result) -> Path | None:
    """Walk Gradio return value for a .glb/.obj path."""
    if isinstance(result, (str, Path)):
        p = Path(result)
        if p.suffix.lower() in {".glb", ".obj", ".fbx"} and p.exists():
            return p

    if isinstance(result, (list, tuple)):
        for item in result:
            found = extract_glb_path(item)
            if found:
                return found

    if isinstance(result, dict):
        for value in result.values():
            found = extract_glb_path(value)
            if found:
                return found

    return None


def print_retarget_command(output: Path) -> None:
    template = ROOT / "public" / "models" / "ybot_mixamo.glb"
    dest = ROOT / "public" / "models" / f"{output.stem.replace('_mhr', '')}_mixamo.glb"
    print()
    print("Next step — retarget to Mixamo skeleton:")
    print(
        f"  blender --background --python scripts/blender/retarget_mhr_to_mixamo.py -- \\\n"
        f"    --input {output} \\\n"
        f"    --template {template} \\\n"
        f"    --output {dest}"
    )


def main() -> int:
    args = parse_args()

    if not args.image.exists():
        print(f"Error: image not found: {args.image}", file=sys.stderr)
        return 1

    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if not hf_token:
        print(
            "Warning: HF_TOKEN not set. Gated models may fail.\n"
            "  export HF_TOKEN=hf_...",
            file=sys.stderr,
        )

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    output = args.output or RAW_DIR / f"{args.name}_mhr.glb"

    spaces = [args.space] if args.space else DEFAULT_SPACES

    try:
        from gradio_client import Client  # noqa: F401
    except ImportError:
        print("Install dependencies: pip install -r scripts/requirements.txt", file=sys.stderr)
        return 1

    result_path: Path | None = None
    for space_id in spaces:
        if not space_id:
            continue
        try:
            result_path = try_space(space_id, args.image, hf_token)
            if result_path:
                break
        except Exception as exc:
            print(f"Space {space_id} error: {exc}")

    if not result_path:
        print(
            "\nAutomatic Space call failed. Manual fallback:\n"
            "  1. Open https://huggingface.co/spaces/akhaliq/sam-3d-body\n"
            "  2. Upload your photo and download the GLB/OBJ\n"
            f"  3. Save to {output}\n"
            "  4. Run the Blender retarget command below",
            file=sys.stderr,
        )
        print_retarget_command(output)
        return 2

    shutil.copy2(result_path, output)
    print(f"Saved: {output}")
    print_retarget_command(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
