/**
 * Safely parse a JSON string from localStorage.
 * Returns `null` (or the provided fallback) if the value is missing or invalid.
 */
export function safeJSONParse(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined || raw === "undefined") {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}":`, error);
    return fallback;
  }
}
