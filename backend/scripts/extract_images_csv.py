#!/usr/bin/env python3
import csv
import sys

input_path = '/var/www/Project-Roma/backend/scripts/inventory.csv'
output_path = '/var/www/Project-Roma/backend/scripts/product_images.csv'

with open(input_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Total rows: {len(rows)}")

lines = ['sku,upc,image_url']
for row in rows:
    sku = row.get('SKU', '').strip()
    upc = row.get('upc from pricebook', '').strip()
    url = row.get('Images', '').strip()
    if sku and url:
        # CSV-escape fields
        def esc(s):
            s = str(s).replace('"', '""')
            return f'"{s}"' if ('"' in s or ',' in s or '\n' in s) else s
        lines.append(f'{esc(sku)},{esc(upc)},{esc(url)}')

with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print(f"Wrote {len(lines)-1} rows to {output_path}")

# Show sample
for line in lines[:5]:
    print(line)
