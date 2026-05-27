#!/usr/bin/env python3
"""
remove-bg-white.py

Removes the background from a product photo and replaces it with pure white.
Uses rembg (U²Net) for background removal, then composites onto white.

Usage:
    ./venv-rembg/bin/python scripts/remove-bg-white.py input.jpg output.jpg
"""

import sys
from pathlib import Path
from PIL import Image
from rembg import remove


def process_image(input_path: str, output_path: str) -> None:
    """Remove background and composite onto pure white."""
    input_img = Image.open(input_path).convert("RGBA")

    # Remove background
    no_bg = remove(input_img)

    # Create white background
    white_bg = Image.new("RGBA", no_bg.size, (255, 255, 255, 255))

    # Composite: white_bg + product (alpha from no_bg)
    white_bg.paste(no_bg, (0, 0), no_bg)

    # Convert to RGB for smaller JPEG output
    final = white_bg.convert("RGB")

    # Save with high quality
    final.save(output_path, "JPEG", quality=95)
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: remove-bg-white.py <input.jpg> <output.jpg>")
        sys.exit(1)

    process_image(sys.argv[1], sys.argv[2])
