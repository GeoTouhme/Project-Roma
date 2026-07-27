/**
 * Filter a flat category list down to the approved hierarchy parents.
 *
 * The backend now returns an `order` field on categories. The approved
 * 2-level hierarchy parents have order values 1–13. This helper keeps only
 * those parents and sorts them by order.
 *
 * @param {Array} categories
 * @returns {Array}
 */
export default function getHierarchyCategories(categories = []) {
  if (!Array.isArray(categories)) return [];
  return categories
    .filter((cat) => Number(cat.order) > 0)
    .sort((a, b) => Number(a.order) - Number(b.order));
}
