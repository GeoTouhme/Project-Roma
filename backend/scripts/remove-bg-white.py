#!/usr/bin/env python3
"""
remove-bg-white.py

Removes the background from a product photo and replaces it with pure white.
Supports two modes:

  1. CLI mode (backward compatible):
     ./venv-rembg/bin/python scripts/remove-bg-white.py input.jpg output.jpg

  2. Worker mode (fast batch processing):
     ./venv-rembg/bin/python scripts/remove-bg-white.py --worker
     Then feed lines via stdin:  input.jpg\toutput.jpg
     Read results via stdout:    OK\toutput.jpg   or   ERR\tmessage
"""

import sys
from pathlib import Path
from PIL import Image, ImageOps
from rembg import remove, new_session

# ─── Shared processing ───────────────────────────────────────────

SESSION = None


def process_image(input_path: str, output_path: str) -> None:
    """Remove background and composite onto pure white."""
    input_img = Image.open(input_path).convert("RGBA")

    # Respect camera rotation
    input_img = ImageOps.exif_transpose(input_img)

    # Downscale before U²Net to save decode + composite time
    input_img.thumbnail((1024, 1024), Image.LANCZOS)

    # Remove background (reuse loaded session in worker mode)
    no_bg = remove(input_img, session=SESSION)

    # Create white background
    white_bg = Image.new("RGBA", no_bg.size, (255, 255, 255, 255))

    # Composite: white_bg + product (alpha from no_bg)
    white_bg.paste(no_bg, (0, 0), no_bg)

    # Convert to RGB for smaller JPEG output
    final = white_bg.convert("RGB")

    # Save with high quality
    final.save(output_path, "JPEG", quality=92, subsampling=0)


# ─── CLI mode ────────────────────────────────────────────────────


def cli_mode() -> None:
    if len(sys.argv) < 4:
        print("Usage: remove-bg-white.py <input.jpg> <output.jpg>")
        sys.exit(1)

    process_image(sys.argv[2], sys.argv[3])
    print(f"Saved: {sys.argv[3]}")


# ─── Worker mode ─────────────────────────────────────────────────


def worker_mode() -> None:
    global SESSION
    SESSION = new_session("u2net")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            inp, outp = line.split("\t")
            process_image(inp, outp)
            sys.stdout.write(f"OK\t{outp}\n")
        except Exception as e:
            sys.stdout.write(f"ERR\t{e}\n")
        sys.stdout.flush()


# ─── Entry point ─────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--worker":
        worker_mode()
    else:
        cli_mode()
