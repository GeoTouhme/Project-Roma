import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/header";
import Footer from "../../components/footer";
import Breadcrumb from "../../components/breadcrumb";
import Icons from "../../components/svg";
import ProductImage1 from "../../assets/images/product-img-1.png";
import ProductImage2 from "../../assets/images/product-img-2.png";
import ProductImage3 from "../../assets/images/product-img-3.png";
import ProductImage4 from "../../assets/images/product-img-4.png";
import ProductImage5 from "../../assets/images/product-img-5.png";
import ProductImage6 from "../../assets/images/product-img-6.png";
import ProductImage7 from "../../assets/images/product-img-7.png";
import ProductImage8 from "../../assets/images/product-img-8.png";
import ProductCard from "../../components/product-card";

const Collection = () => {
  const filters = [
    {
      name: "Price",
      type: "range",
      min: 50,
      max: 1200,
    },
    {
      name: "Brands",
      type: "checkbox",
      options: [
        "Pappy Van Winkle",
        "Blanton's",
        "Rock Hill Farms",
        "Kah",
        "Buffalo Trace",
        "Eagle Rare",
        "Four Roses",
        "Maker's Mark",
      ],
    },
    {
      name: "Availability",
      type: "checkbox",
      options: ["In stock", "Out of stock"],
    },
  ];

  const CategoryProducts = [
    {
      id: 1,
      title: "Elegant Bordeaux Blend Reserve Precious Rose",
      volume: "800 ML",
      price: 49.99,
      image: ProductImage1,
      rating: 4.5,
      isWishlisted: true,
    },
    {
      id: 2,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage2,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 3,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage3,
      rating: 4,
      isWishlisted: false,
    },
    {
      id: 4,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage4,
      rating: 3.5,
      isWishlisted: false,
    },
    {
      id: 5,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "600 ML",
      price: 49.99,
      image: ProductImage5,
      rating: 4.5,
      isWishlisted: false,
    },
    {
      id: 6,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage6,
      rating: 4,
      isWishlisted: false,
    },
    {
      id: 7,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage7,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 48,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1200 ML",
      price: 49.99,
      image: ProductImage8,
      rating: 4,
      isWishlisted: false,
    },
  ];
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1023);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState(
    filters.reduce((acc, filter) => ({ ...acc, [filter.name]: true }), {})
  );
  const [viewMore, setViewMore] = useState({});
  const [priceRange, setPriceRange] = useState({ min: 50, max: 1200 });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1023);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleFilter = (name) => {
    setExpandedFilters((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleViewMore = (name) => {
    setViewMore((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleMinChange = (e) => {
    const newMin = Math.min(Number(e.target.value), priceRange.max - 10);
    setPriceRange((prev) => ({ ...prev, min: newMin }));
  };

  const handleMaxChange = (e) => {
    const newMax = Math.max(Number(e.target.value), priceRange.min + 10);
    setPriceRange((prev) => ({ ...prev, max: newMax }));
  };

  const renderFilterOptions = (filter) => {
    if (filter.type === "range") {
      return (
        <div className="mt-5">
          <div className="relative h-0.5 w-full mt-2">
            {/* Track */}
            <div className="relative h-0.5 bg-black rounded-lg">
              <div
                className="absolute h-0.5 bg-primary rounded-lg"
                style={{
                  left: `${((priceRange.min - filter.min) / (filter.max - filter.min)) * 100}%`,
                  right: `${100 - ((priceRange.max - filter.min) / (filter.max - filter.min)) * 100}%`,
                }}
              />
            </div>

            {/* Min Slider */}
            <input
              type="range"
              min={filter.min}
              max={filter.max}
              value={priceRange.min}
              onChange={handleMinChange}
              className="absolute top-0 h-[2px] w-full appearance-none bg-transparent pointer-events-auto min_range"
              style={{ zIndex: priceRange.min > filter.max - 100 ? "5" : "3" }}
            />

            {/* Max Slider */}
            <input
              type="range"
              min={filter.min}
              max={filter.max}
              value={priceRange.max}
              onChange={handleMaxChange}
              className="absolute bottom-0 h-[2px] w-full appearance-none bg-transparent pointer-events-auto"
              style={{ zIndex: priceRange.max < filter.min + 100 ? "5" : "3" }}
            />

            {/* Price Labels */}
          </div>
          <div className="flex justify-between text-sm mt-5">
            <span className="text-black/60 font-medium">${priceRange.min}</span>
            <span className="text-black/60 font-medium">${priceRange.max}</span>
          </div>
        </div>
      );
    } else if (filter.type === "checkbox") {
      return (
        <ul className="space-y-2 mt-4">
          {filter.options.slice(0, viewMore[filter.name] ? filter.options.length : 5).map((option, index) => (
            <li key={index} className="flex items-center space-x-2">
              <input type="checkbox" className="w-4 h-4" id={option} value={option} />
              <label for={option}>{option}</label>
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
  };

  return (
    <div className="main">
      <div className="page-title text-center mx-auto py-10">
        <h2 className="text-[30px] font-bold mb-2">Collections</h2>
        <div className="breadcrumbs">
          <Breadcrumb />
        </div>
      </div>
      <div className="container md:pb-[100px] pb-[40px]">
        <div className="collection_grid_filter grid lg:grid-cols-[300px,1fr] grid-cols-1 gap-5">
          <div className="filter">
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
              <h2 className="text-xl font-semibold mb-2 text-primary">Filters</h2>
              {filters.map((filter, index) => (
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
                  <h2 className="text-xl font-semibold mb-2 text-primary flex items-center justify-between">
                    Filters
                    <button className="" onClick={() => setIsOpen(false)}>
                      <Icons name="close" width={10} height={10} color="#000000" />
                    </button>
                  </h2>
                  {filters.map((filter, index) => (
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
            <div className="products_list grid grid-cols-2 md:grid-cols-3 md:gap-5 gap-2">
              {CategoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Collection;
