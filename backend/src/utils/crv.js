/**
 * CRV (California Redemption Value) utilities.
 *
 * CRV is charged per container:
 *   - < 24 fl oz  → $0.05
 *   - ≥ 24 fl oz  → $0.10
 *
 * We parse the free-text size label from the pricebook/admin panel
 * into fluid ounces so the per-item CRV can be determined automatically.
 */

const FL_OZ_TO_OZ = 1;
const ML_TO_OZ = 1 / 29.5735;
const L_TO_OZ = 33.814;

/**
 * Convert common size strings to fluid ounces.
 * Returns null if the size cannot be parsed reliably.
 */
function parseSizeToOz(size) {
  if (!size || typeof size !== 'string') return null;
  const normalized = size.toLowerCase().replace(/,/g, '').trim();

  // Direct fl oz patterns: "12 oz", "12oz", "12 fl oz", "12fl.oz"
  const flOzMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz/);
  if (flOzMatch) return parseFloat(flOzMatch[1]);

  // Liters: "1L", "1.75 L", "1.75L"
  const literMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:liter|litre|l)\b/);
  if (literMatch) return parseFloat(literMatch[1]) * L_TO_OZ;

  // Milliliters: "750ml", "750 ml", "375ml"
  const mlMatch = normalized.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) return parseFloat(mlMatch[1]) * ML_TO_OZ;

  // "12/12oz" or "6 x 12 oz" — treat as a single sale unit, so per-container is one can.
  // We still return the individual container size for CRV purposes.
  const packMatch = normalized.match(/\d+\s*[x/]\s*(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz/);
  if (packMatch) return parseFloat(packMatch[1]);

  return null;
}

/**
 * Determine the per-item CRV based on the product size label.
 * Falls back to the category's default crvRate if size cannot be parsed.
 *
 * CA CRV per container:
 *   - Standard single-serve / 750 mL bottles      → $0.05
 *   - Large containers (≥ 1 liter / ~34 fl oz)  → $0.10
 *
 * The threshold is intentionally set at 30 fl oz so that 750 mL (~25.4 fl oz)
 * remains in the $0.05 tier while 1L and larger containers move to $0.10.
 */
function getCrvPerItem(size, categoryCrvRate = 0) {
  const oz = parseSizeToOz(size);

  // If we cannot parse the size and the category has a flat rate, use that.
  if (oz === null) {
    return typeof categoryCrvRate === 'number' ? categoryCrvRate : 0;
  }

  // Category must be CRV-eligible for any deposit to apply.
  if (!categoryCrvRate) return 0;

  return oz >= 30 ? 0.1 : 0.05;
}

/**
 * Round a number to 2 decimal places.
 */
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

module.exports = {
  parseSizeToOz,
  getCrvPerItem,
  round2,
};
