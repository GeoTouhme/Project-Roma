import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Read and write parent/subcategory filter slugs from the URL path.
 *
 * Project Roma uses path-based routing for the collection page:
 *   /products
 *   /products/:category
 *   /products/:category/:subCategory
 *
 * @returns {{ selectedCategory: string | null, selectedSubCategory: string | null, setFilter: (categorySlug: string | null, subCategorySlug: string | null) => void }}
 */
export default function useCategoryFilter() {
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = useMemo(() => {
    return location.pathname.split("/").filter(Boolean);
  }, [location.pathname]);

  const selectedCategory = useMemo(() => {
    // pathParts[0] is "products", [1] is optional category, [2] is optional subcategory
    return pathParts[1] || null;
  }, [pathParts]);

  const selectedSubCategory = useMemo(() => {
    return pathParts[2] || null;
  }, [pathParts]);

  const setFilter = useCallback(
    (categorySlug, subCategorySlug) => {
      if (!categorySlug) {
        navigate("/products");
        return;
      }

      if (subCategorySlug) {
        navigate(`/products/${categorySlug}/${subCategorySlug}`);
      } else {
        navigate(`/products/${categorySlug}`);
      }
    },
    [navigate]
  );

  return {
    selectedCategory,
    selectedSubCategory,
    setFilter,
  };
}
