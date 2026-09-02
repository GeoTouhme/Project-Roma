import React, { useState, useEffect, useCallback } from "react";
import Breadcrumb from "../../components/breadcrumb";
import Icons from "../../components/svg";
import ProductCard from "../../components/product-card";
import ProductService from "../../services/productService";
import CategoriesService from "../../services/categoriesService";
import { useLocation, useNavigate } from "react-router-dom";
import ProductCardSkeleton from "../../components/skeleton/productCardSkeleton";
import CategoryFilter from "../../components/category-filter";
import { safeJSONParse } from "../../utils/safeStorage";

const Collection = () => {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const location = useLocation();
  const navigate = useNavigate();

  // Extract search query from URL
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get("search") || "";

  const pathParts = location.pathname.split("/").filter(Boolean); // removes empty segments
  const category = pathParts[1] || null;
  const subCategory = pathParts[2] || null;
  const isAuthenticated = safeJSONParse("isAuthenticated", false);
  const userInfo = isAuthenticated ? safeJSONParse("user", null) : null;
  const [reload, setReload] = useState(false);

  // Reset page when path or search changes
  useEffect(() => {
    setPage(1);
    setProducts([]); // Clear products to avoid mixing old/new data visually during fetch
  }, [location.pathname, location.search, category, subCategory]);

  useEffect(() => {
    const user_id = userInfo?._id || "";

    fetchProducts({
      user_id,
      category,
      subCategory,
      search: searchQuery,
      page,
      limit: 12
    }, page > 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, reload, category, subCategory, isAuthenticated, page, searchQuery]);

  // Fetch categories on mount
  useEffect(() => {
    CategoriesService.allCatgeories()
      .then((response) => {
        if (response?.success) {
          setCategories(response.data);
        }
      })
      .catch((err) => console.error("Categories fetch failed:", err));
  }, []);

  const fetchProducts = (params, isAppending) => {
    setProductsLoading(true)
    ProductService.allProducts(params)
      .then((response) => {
        if (response.success && Array.isArray(response.data)) {
          // If appending, add to existing products. Otherwise replace.
          if (isAppending) {
            setProducts(prev => [...prev, ...response.data]);
          } else {
            setProducts(response.data);
          }
          // Update total pages from backend response
          if (response.count) {
            setTotalPages(response.count);
          }
        } else {
          console.error("Invalid product data:", response);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch products:", error);
      }).finally(() => {
        setProductsLoading(false)
      });
  };

  const handleLoadMore = () => {
    if (page < totalPages) {
      setPage(prev => prev + 1);
    }
  };

  // Clear category filter and return to all products
  const clearAllFilters = useCallback(() => {
    if (category) {
      navigate('/products');
    }
  }, [category, navigate]);
  return (
    <div className="main">
      <div className="page-title text-center mx-auto py-10">
        <h2 className="text-[30px] font-bold mb-2">Products</h2>
        <div className="breadcrumbs">
          <Breadcrumb />
        </div>
      </div>
      <div className="container md:pb-[100px] pb-[40px]">
        {/* Category chip filter — products page only */}
        {categories?.length > 0 && (
          <div className="mb-6">
            <CategoryFilter categories={categories} />
          </div>
        )}

        <div className="collection_grid_filter">
          <div className="collection_grid">
            {products.length === 0 && !productsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                   <Icons name="search" width={32} height={32} color="#D1D5DB" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500 text-center max-w-xs mb-8">
                  We couldn't find any products matching your current search or filters.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="px-6 py-2.5 bg-primary text-white rounded-full font-bold hover:shadow-lg transition-all active:scale-95"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="products_list grid grid-cols-2 md:grid-cols-4 md:gap-5 gap-2">
                  {products.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={{
                        id: product._id,
                        slug: product.slug,
                        title: product.name,
                        image: product.image,
                        priceSale: product.priceSale,
                        price: product.price,
                        rating: product.averageRating || 0,
                        isWishlisted: product.isWishlisted,
                        isBestSeller: product.isBestSeller,
                        isTopCollection: product.isTopCollection,
                      }}
                      wishListDone={() => setReload(!reload)}
                    />
                  ))}
                  {productsLoading && (
                    <>
                      <ProductCardSkeleton />
                      <ProductCardSkeleton />
                      <ProductCardSkeleton />
                    </>
                  )}
                </div>

                {/* Load More Button */}
                {page < totalPages && !productsLoading && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={handleLoadMore}
                      className="px-6 py-2 bg-primary text-white rounded-md font-semibold hover:bg-opacity-90 transition-colors"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Collection;
