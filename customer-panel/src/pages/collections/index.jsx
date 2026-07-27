import React, { useState, useEffect, useMemo, useCallback } from "react";
import Breadcrumb from "../../components/breadcrumb";
import Icons from "../../components/svg";
import ProductCard from "../../components/product-card";
import ProductService from "../../services/productService";
import CategoriesService from "../../services/categoriesService";
import { useLocation, useNavigate } from "react-router-dom";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css"
import ProductCardSkeleton from "../../components/skeleton/productCardSkeleton";
import CategoryFilter from "../../components/category-filter";
import getHierarchyCategories from "../../utils/getHierarchyCategories";

const Collection = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1023);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState({});
  const [viewMore, setViewMore] = useState({});

  const MIN_PRICE = 0;
  const MAX_PRICE = 500;

  const [priceRange, setPriceRange] = useState({ min: MIN_PRICE, max: MAX_PRICE });

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [filtersData, setFiltersData] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
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
  const isAuthenticated = JSON.parse(localStorage.getItem("isAuthenticated"));
  const [reload, setReload] = useState(false);

  // Reset page when filters or search change
  useEffect(() => {
    setPage(1);
    setProducts([]); // Clear products to avoid mixing old/new data visually during fetch
  }, [location.pathname, location.search, selectedBrand, selectedColors, priceRange, selectedSizes, category, subCategory]);

  useEffect(() => {
    let user_id = ""
    if (isAuthenticated) {
      const userInfo = JSON.parse(localStorage.getItem("user"));
      user_id = userInfo?._id
    }
    const colorsStr = selectedColors.join("_");
    const sizesStr = selectedSizes.join("_");

    fetchProducts({
      user_id,
      category,
      subCategory,
      brand: selectedBrand,
      colors: colorsStr,
      sizes: sizesStr,
      prices: `${priceRange.min}_${priceRange.max}`,
      search: searchQuery, // Pass search query to API
      page: page, // Pass current page
      limit: 12 // Default limit
    }, page > 1); // Pass flag if appending
  }, [location.pathname, location.search, selectedBrand, selectedColors, priceRange, selectedSizes, reload, category, subCategory, isAuthenticated, page, searchQuery]);

  useEffect(() => {
    setLoadingFilters(true)
    // Call filters API conditionally
    if (!category && !subCategory) {
      ProductService.getFilters()
        .then((res) => setFiltersData(res?.data))
        .catch((err) => console.error("Filters fetch failed:", err))
        .finally(() => setLoadingFilters(false));
    } else if (category && !subCategory) {
      ProductService.getFiltersByCategory(category)
        .then((res) => setFiltersData(res?.data))
        .catch((err) => console.error("Category filters fetch failed:", err))
        .finally(() => setLoadingFilters(false));
    } else if (category && subCategory) {
      ProductService.getFiltersBySubCategory(category, subCategory)
        .then((res) => setFiltersData(res?.data))
        .catch((err) => console.error("Subcategory filters fetch failed:", err))
        .finally(() => setLoadingFilters(false));
    }
  }, [category, subCategory])

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

  // Memoize dynamic filters to prevent regeneration on every render
  const dynamicFilters = useMemo(() => {
    const filters = [];

    // Add categories filter — only approved hierarchy parents
    const hierarchyCategories = getHierarchyCategories(categories);
    if (hierarchyCategories?.length) {
      filters.push({
        name: "Categories",
        type: "category",
        options: hierarchyCategories.map((cat) => ({
          label: cat.name,
          value: cat.slug,
        })),
      });
    }

    if (filtersData?.prices?.length) {
      filters.push({
        name: "Price",
        type: "range",
        min: filtersData.prices[0],
        max: filtersData.prices[1],
      });
    }

    if (filtersData?.brands?.length) {
      filters.push({
        name: "Brands",
        type: "radio",
        options: filtersData.brands.map((b) => ({
          label: b.name,
          value: b.slug,
        })),
      });
    }

    if (filtersData?.colors?.length) {
      filters.push({
        name: "Colors",
        type: "checkbox",
        options: filtersData.colors,
      });
    }

    if (filtersData?.sizes?.length) {
      filters.push({
        name: "Sizes",
        type: "checkbox",
        options: filtersData.sizes,
      });
    }

    return filters;
  }, [filtersData, categories]);

  // Initialize expanded filters when dynamic filters change
  useEffect(() => {
    setExpandedFilters(
      dynamicFilters.reduce((acc, filter) => ({ ...acc, [filter.name]: true }), {})
    );
  }, [dynamicFilters]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1023);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleFilter = useCallback((name) => {
    setExpandedFilters((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const toggleViewMore = useCallback((name) => {
    setViewMore((prev) => ({ ...prev, [name]: !prev[name] }));
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

  const handleCheckboxChange = useCallback((e, option, filterName) => {
    const currentSelected = filterName === "Colors" ? selectedColors : selectedSizes;
    const setter = filterName === "Colors" ? setSelectedColors : setSelectedSizes;

    if (e.target.checked) {
      setter([...currentSelected, option]);
    } else {
      setter(currentSelected.filter((item) => item !== option));
    }
  }, [selectedColors, selectedSizes]);

  const handleCategoryChange = useCallback((categorySlug) => {
    if (categorySlug) {
      navigate(`/products/${categorySlug}`);
    } else {
      navigate('/products');
    }
  }, [navigate]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      selectedBrand !== "" ||
      selectedColors.length > 0 ||
      selectedSizes.length > 0 ||
      (priceRange.min !== MIN_PRICE || priceRange.max !== MAX_PRICE) ||
      category !== null
    );
  }, [selectedBrand, selectedColors, selectedSizes, priceRange, category]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSelectedBrand("");
    setSelectedColors([]);
    setSelectedSizes([]);
    setPriceRange({ min: MIN_PRICE, max: MAX_PRICE });
    if (category) {
      navigate('/products');
    }
  }, [category, navigate]);

  const renderFilterOptions = (filter) => {
    if (filter.type === "category") {
      return (
        <ul className="space-y-2 mt-4">
          {filter.options
            .slice(0, viewMore[filter.name] ? filter.options.length : 5)
            .map((option, index) => (
              <li key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  className="w-4 h-4"
                  id={`category-${option.value}`}
                  name="category"
                  value={option.value}
                  checked={category === option.value}
                  onChange={() => handleCategoryChange(option.value)}
                />
                <label htmlFor={`category-${option.value}`} className="cursor-pointer">
                  {option.label}
                </label>
              </li>
            ))}
          {filter.options.length > 5 && (
            <button
              onClick={() => toggleViewMore(filter.name)}
              className="text-primary text-sm mt-2 underline text-end ms-auto block font-medium"
            >
              {viewMore[filter.name] ? "View Less" : "View All"}
            </button>
          )}
        </ul>
      );
    } else if (filter.type === "range") {
      return (
        <div className="mt-5">
          <Slider
            range
            min={MIN_PRICE}
            max={MAX_PRICE}
            value={[priceRange.min, priceRange.max]}
            onChange={([min, max]) => setPriceRange({ min, max })}
            trackStyle={[{ backgroundColor: '#B5223B' }]}
            handleStyle={[
              { borderColor: '#B5223B', backgroundColor: '#fff' },
              { borderColor: '#B5223B', backgroundColor: '#fff' },
            ]}
            railStyle={{ backgroundColor: '#e5e7eb' }}
          />
          <div className="flex justify-between text-sm mt-4">
            <span className="text-black/60 font-medium">${priceRange.min}</span>
            <span className="text-black/60 font-medium">${priceRange.max}</span>
          </div>
        </div>
      );
    } else if (filter.type === "radio") {
      return (
        <ul className="space-y-2 mt-4">
          {filter.options
            .slice(0, viewMore[filter.name] ? filter.options.length : 5)
            .map((option, index) => (
              <li key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  className="w-4 h-4"
                  id={`${filter.name} - ${option.value}`} // Use slug as the id
                  name={filter.name} // Important for radio group behavior
                  value={option.value} // Slug as the value
                  checked={selectedBrand === option.value}
                  onChange={() => setSelectedBrand(option.value)} // Set slug as the selected value
                />
                <label htmlFor={`${filter.name} - ${option.value}`}>{option.label}</label> {/* Show name as label */}
              </li>
            ))}
          {filter.options.length > 5 && (
            <button
              onClick={() => toggleViewMore(filter.name)}
              className="text-primary text-sm mt-2 underline text-end ms-auto block font-medium"
            >
              {viewMore[filter.name] ? "View Less" : "View All"}
            </button>
          )}
        </ul>
      );
    } else if (filter.type === "checkbox") {
      return (
        <ul className="space-y-2 mt-4">
          {filter.options.slice(0, viewMore[filter.name] ? filter.options.length : 5).map((option, index) => (
            <li key={index} className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="w-4 h-4"
                id={`${filter.name}-${option}`}
                value={option}
                checked={
                  (filter.name === "Colors" ? selectedColors : selectedSizes).includes(option)
                }
                onChange={(e) => handleCheckboxChange(e, option, filter.name)} // Pass filter name to handle change
              />
              <label htmlFor={`${filter.name}-${option}`}>{option}</label>
            </li>
          ))}
          {filter.options.length > 5 && (
            <button
              onClick={() => toggleViewMore(filter.name)}
              className="text-primary text-sm mt-2 underline text-end ms-auto block font-medium"
            >
              {viewMore[filter.name] ? "View Less" : "View All"}
            </button>
          )}
        </ul>
      );
    }


    return null;
  };
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

        <div className="collection_grid_filter grid lg:grid-cols-[300px,1fr] grid-cols-1 gap-5">
          <div className="filter">
            {/* Mobile Filter Button */}
            {isMobile && (
              <button
                className="text-black rounded-lg font-medium text-[18px] flex items-center gap-2"
                onClick={() => setIsOpen(true)}
              >
                <Icons name="filter" width={15} height={15} color="#000000" />
                Filter
              </button>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-full p-4 border border-primary rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-primary">Filters</h2>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
              {loadingFilters ? (
                [...Array(4)].map((_, index) => (
                  <div key={index} className="border-b border-[#cbcbcb] py-4 filter_block">
                    <Skeleton width="100%" height={30} />
                    <Skeleton width="80%" height={20} />
                  </div>
                ))
              ) : dynamicFilters.map((filter, index) => (
                <div key={index} className="border-b border-[#cbcbcb] py-4 filter_block">
                  <button
                    onClick={() => toggleFilter(filter.name)}
                    className="w-full flex items-center justify-between text-left text-black font-semibold text-[18px]"
                  >
                    {filter.name}
                    <span>
                      {expandedFilters[filter.name] ? (
                        <Icons name="menu_up_arrow" width={12} height={12} color="#000000" />
                      ) : (
                        <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />
                      )}
                    </span>
                  </button>
                  {expandedFilters[filter.name] && renderFilterOptions(filter)}
                </div>
              ))}
            </aside>

            {/* Mobile Drawer */}
            {isMobile && isOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-[1]">
                <div className="w-[320px] h-full bg-white shadow-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold text-primary">Filters</h2>
                    <button onClick={() => setIsOpen(false)}>
                      <Icons name="close" width={10} height={10} color="#000000" />
                    </button>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-primary hover:underline font-medium mb-3 block"
                    >
                      Clear All Filters
                    </button>
                  )}
                  {loadingFilters ? (
                    [...Array(4)].map((_, index) => (
                      <div key={index} className="border-b py-2">
                        <Skeleton width="100%" height={30} />
                        <Skeleton width="80%" height={20} />
                      </div>
                    ))
                  ) : dynamicFilters.map((filter, index) => (
                    <div key={index} className="border-b py-2">
                      <button
                        onClick={() => toggleFilter(filter.name)}
                        className="w-full flex items-center justify-between text-left text-black font-semibold text-[18px]"
                      >
                        {filter.name}
                        <span>
                          {expandedFilters[filter.name] ? (
                            <Icons name="menu_up_arrow" width={12} height={12} color="#000000" />
                          ) : (
                            <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />
                          )}
                        </span>
                      </button>
                      {expandedFilters[filter.name] && renderFilterOptions(filter)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                        image: product.image?.url,
                        priceSale: product.priceSale,
                        price: product.price,
                        rating: product.averageRating || 0,
                        isWishlisted: product.isWishlisted,
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
