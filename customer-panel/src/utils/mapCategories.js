import getHierarchyCategories from "./getHierarchyCategories";

/**
 * Transform the /all-categories API response into the parent/children shape
 * expected by the CategoryFilter component.
 *
 * The backend returns categories with a populated subCategories array:
 *   { _id, name, slug, order, subCategories: [{ _id, name, slug, order }] }
 *
 * We keep only the approved hierarchy parents (order > 0), sort them by order,
 * and add a children array plus optional productCount badges.
 *
 * @param {Array} categories
 * @returns {Array<{ _id: string, name: string, slug: string, productCount: number, children: Array<{ _id: string, name: string, slug: string, productCount: number }> }>}
 */
export default function mapCategories(categories = []) {
  const hierarchy = getHierarchyCategories(categories);

  return hierarchy.map((parent) => {
    const children = (parent.subCategories || [])
      .filter((sub) => Number(sub.order) > 0)
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((sub) => ({
        _id: sub._id,
        name: sub.name,
        slug: sub.slug,
        productCount: Number(sub.productCount) || 0,
      }));

    return {
      _id: parent._id,
      name: parent.name,
      slug: parent.slug,
      productCount: Number(parent.productCount) || 0,
      children,
    };
  });
}
