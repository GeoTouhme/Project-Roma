import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../assets/images/Logo.png";
import Icons from "../svg";
import Skeleton from "react-loading-skeleton";
import { useLocation } from "react-router-dom";
import CategoriesService from "../../services/categoriesService";
import SearchService from "../../services/searchService";
import { useSelector } from "react-redux";

const Header = () => {
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false); // Mobile Main Menu
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null); // Mobile Mega Menu
  const [menuData, setMenuData] = useState([
    { title: "Home", link: "/" },
    { title: "Products", link: "/products" },
  ]);
  const [categoryData, setCategoryData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState({ products: [], categories: [], brands: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  
  let isAuthenticated = false;
  try {
    const authData = localStorage.getItem("isAuthenticated");
    isAuthenticated = authData ? JSON.parse(authData) : false;
  } catch (e) {
    console.error("Auth sync error", e);
    localStorage.removeItem("isAuthenticated");
  }

  // Handle Search Suggestions with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length > 1) {
        setIsSearching(true);
        SearchService.getSuggestions(searchTerm.trim())
          .then((res) => {
            if (res.success) {
              setSuggestions({
                products: res.products || [],
                categories: res.categories || [],
                brands: res.brands || []
              });
              setShowSuggestions(true);
            }
          })
          .catch((err) => console.error("Search error:", err))
          .finally(() => setIsSearching(false));
      } else {
        setSuggestions({ products: [], categories: [], brands: [] });
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setShowSuggestions(false);
      navigate(`/products?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const handleSuggestionClick = (type, item) => {
    setShowSuggestions(false);
    setSearchTerm("");
    if (type === 'product') {
      navigate(`/product/${item.slug}`);
    } else if (type === 'category') {
      navigate(`/products/${item.slug}`);
    }
  };

  const handleAccountNavigate = () => {

    if (!isAuthenticated) {
      navigate("/login");
    } else {
      navigate("/account");
    }
  };

  const fetchAllCategories = () => {
    setLoading(true)
    CategoriesService.allCatgeories()
      .then((response) => {
        if (response?.success) {

          const formattedData = response.data.map((category) => ({
            title: category.name,
            link: `/products/${category.slug}`,
            subMenu: category.subCategories?.length
              ? [
                {
                  links: category.subCategories.map((sub) => ({
                    name: sub.name,
                    url: `/products/${category.slug}/${sub.slug}`,
                  })),
                },
              ]
              : null,
          }));

          setCategoryData(formattedData);
        }
      })
      .catch((error) => {
        console.log("error = ", error);
      }).finally(() => {
        setLoading(false)
      });
  };

  useEffect(() => {
    fetchAllCategories();
  }, []);

  return (
    <div id="header" className="header">
      <div className="top_header">
        <div className="container">
          <div className="top_header_left py-3 flex items-center border-b border-border_color">
            <Link to="tel:(+1) 949-200-9377" className="text-[15px] relative">
              (+1) 949-200-9377
            </Link>
            <Link to="mailto:balport@gmail.com" className="text-[15px] relative">
              balport@gmail.com
            </Link>
            <div className="text-[15px] relative hidden md:block">4521 West Coast Hwy, Newport Beach, CA 92663، USA</div>
          </div>
        </div>
      </div>
      <div className="bottom_header">
        <div className="container">
          <div className="b_header flex items-center justify-between py-2.5 flex-wrap md:flex-nowrap gap-4">
            <div className="bottom_header_left flex-shrink-0 order-1">
              <Link to="/" className="logo">
                <img
                  src={Logo}
                  alt="logo"
                  className={`xl:w-[90px] w-[60px]`}
                />
              </Link>
            </div>

            <div className="bottom_header_center md:order-2 hidden xl:block">
              <div className="hidden relative xl:flex gap-7 text-black text-[18px] font-medium">
                {loading ? (
                  [...Array(6)].map((_, index) => (
                    <div key={index} className="flex flex-col items-start gap-2">
                      <Skeleton width={150} height={20} />
                    </div>
                  ))
                ) : menuData.map((menu, index) => {
                  const isActive = location.pathname.startsWith(menu.link);
                  return (
                    <div
                      key={index}
                      className=""
                      onMouseEnter={() => menu.subMenu && setActiveMegaMenu(menu.title)}
                      onMouseLeave={() => setActiveMegaMenu(null)}
                    >
                      <Link to={menu.link} className={`flex items-center gap-1 ${isActive ? "text-primary" : ""}`}>
                        {menu.title}
                        {menu.subMenu && <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />}
                      </Link>

                      {activeMegaMenu === menu.title && menu.subMenu && (
                        <div className="absolute top-full bg-white shadow-lg min-w-[250px] py-4 px-6 rounded-lg z-[3]">
                          <div className="flex gap-10 justify-between">
                            {menu.subMenu.map((category, catIndex) => (
                              <ul key={catIndex} className="space-y-1">
                                {category.links.map((item, itemIndex) => (
                                  <li key={itemIndex}>
                                    <Link to={item.url} className="text-black font-normal hover:text-black-500 text-base">
                                      {item.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Global Search Bar with Live Suggestions */}
            <div className="order-4 md:order-3 w-full md:max-w-md lg:max-w-lg mb-2 relative">
              <form onSubmit={handleSearch} className="relative group px-2 md:px-0 flex items-center">
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => searchTerm.trim().length > 1 && setShowSuggestions(true)}
                    className="w-full bg-gray-100 border-2 border-primary/10 rounded-full py-3 px-5 pl-12 pr-24 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none text-black"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                    <Icons name="search" height={20} width={20} color="currentColor" />
                  </div>
                  
                  <button 
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-opacity-90 transition-all shadow-sm"
                  >
                    Search
                  </button>
                </div>
              </form>

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white shadow-2xl rounded-2xl border border-gray-100 z-[200] overflow-hidden max-h-[400px] overflow-y-auto mx-2 md:mx-0">
                  {suggestions.products.length === 0 && suggestions.categories.length === 0 && !isSearching ? (
                    <div className="p-10 text-center">
                       <p className="text-gray-400 text-sm font-medium">No results found for "{searchTerm}"</p>
                    </div>
                  ) : (
                    <>
                      {/* Categories Section */}
                      {suggestions.categories.length > 0 && (
                        <div className="p-3 border-b border-gray-50">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Categories</p>
                          <div className="flex flex-wrap gap-2 px-2">
                            {suggestions.categories.map((cat) => (
                              <div 
                                key={cat._id}
                                onClick={() => handleSuggestionClick('category', cat)}
                                className="bg-gray-50 hover:bg-primary/10 hover:text-primary transition-colors px-3 py-1 rounded-full text-xs font-medium cursor-pointer"
                              >
                                {cat.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Products Section */}
                      {suggestions.products.length > 0 && (
                        <div className="p-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">Products</p>
                          {suggestions.products.map((prod) => (
                            <div 
                              key={prod._id}
                              onClick={() => handleSuggestionClick('product', prod)}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors cursor-pointer rounded-xl"
                            >
                              <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                <img src={prod.images?.[0]?.url} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{prod.name}</p>
                                <p className="text-xs text-primary font-bold">${prod.priceSale || prod.price}</p>
                              </div>
                              <div className="text-gray-300">
                                <Icons name="right_arrow" width={10} height={10} color="currentColor" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {isSearching && (
                    <div className="p-6 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
                       <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              )}

              {/* Close suggestions overlay when clicking outside */}
              {showSuggestions && (
                <div 
                  className="fixed inset-0 z-[-1]" 
                  onClick={() => setShowSuggestions(false)}
                ></div>
              )}
            </div>

            <div className="bottom_header_right flex items-center gap-4 xl:gap-6 order-4">
              <div className="mobile_menu xl:hidden pt-1 hidden">
                <button
                  className="xl:hidden text-white"
                  aria-label="Toggle navigation"
                  onClick={() => setDrawerOpen(true)}
                >
                  <Icons name="menu_bar" width={20} height={20} color="#000000" />
                </button>

                <div
                  className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform ${isDrawerOpen ? "translate-x-0" : "-translate-x-full"
                    } transition-transform duration-300 z-50`}
                >
                  <div className="flex justify-between p-4 border-b ">
                    <span className="font-semibold text-lg"></span>
                    <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                      <Icons name="close" width={12} height={12} color="#000000" />
                    </button>
                  </div>

                  <nav className="flex flex-col gap-4 p-6 text-black text-[16px] font-medium">
                    {menuData.map((menu, index) => (
                      <div key={index}>
                        {menu.subMenu ? (
                          <button
                            className="flex justify-between items-center w-full mobile_megamenu_nav"
                            onClick={() => setOpenMenu(menu.title)}
                          >
                            {menu.title} <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />
                          </button>
                        ) : (
                          <Link to={menu.link} className="text-black text-[16px] font-medium">
                            {menu.title}
                          </Link>
                        )}
                      </div>
                    ))}
                  </nav>
                </div>

                <div
                  className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform ${openMenu ? "translate-x-0" : "-translate-x-full"
                    } transition-transform duration-300 z-50`}
                >
                  <div className="flex items-center p-4 border-b ">
                    <button onClick={() => setOpenMenu(null)} aria-label="Back" className="back_btn">
                      <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />
                    </button>
                    <span className="ml-4 font-medium text-base/[16px]">{openMenu}</span>
                  </div>

                  <div className="p-6 overflow-y-auto h-[100%] pb-20">
                    {menuData
                      .filter((menu) => menu.title === openMenu)
                      .map((menu) =>
                        menu.subMenu.map((category, catIndex) => (
                          <div key={catIndex} className="mb-6">
                            <h4 className="megamenu_col_title relative font-semibold text-primary text-lg mb-4">
                              {category.category}
                            </h4>
                            <ul className="space-y-1">
                              {category.links.map((item, itemIndex) => (
                                <li key={itemIndex}>
                                  <Link to={item.url} className="text-black font-normal hover:text-black-500 text-base">
                                    {item.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))
                      )}
                  </div>
                </div>

                {(isDrawerOpen || openMenu) && (
                  <div
                    className="fixed inset-0 bg-black opacity-50 z-40"
                    onClick={() => {
                      setDrawerOpen(false);
                      setOpenMenu(null);
                    }}
                  ></div>
                )}
              </div>
              <div className="header_user cursor-pointer hidden xl:block" onClick={handleAccountNavigate}>
                <Icons name="user" height={20} width={20} color="#111111" />
              </div>
              {isAuthenticated && <div className="header_wishlist relative cursor-pointer hidden xl:block" onClick={() => navigate("/wishlist")}>
                <Icons name="wishlist" height={20} width={20} color="#111111" />
              </div>}
              <div className="header_cart relative cursor-pointer hidden xl:block" onClick={() => navigate("/cart")}>
                <Icons name="cart_bag" height={20} width={20} color="#111111" />
                {cartCount !== 0 && <div
                  className="cart_count absolute w-[18px] h-[18px] rounded-full bg-primary
                flex items-center justify-center text-[10px] text-white right-[-10px] top-[-6px]"
                >
                  {cartCount}
                </div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
// cache bust 1774023432
