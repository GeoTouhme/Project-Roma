import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../assets/images/Logo.png";
import Icons from "../svg";
import { useLocation } from "react-router-dom";
import SearchService from "../../services/searchService";
import { useSelector } from "react-redux";
import AnnouncementBar from "./AnnouncementBar";
import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from "../../config/orderingConfig";
import { getThumbnailImage } from "../../utils/cloudinary";
import PromoBanner from "../promo-banner";

const Header = () => {
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const menuData = [
    { title: "Home", link: "/" },
    { title: "Products", link: "/products" },
    { title: "Deals", link: "/deals" },
  ];
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState({ products: [], categories: [], brands: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
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

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle click outside to close search
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchExpanded(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle escape key to close search
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsSearchExpanded(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

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
      setIsSearchExpanded(false);
      navigate(`/products?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const handleSuggestionClick = (type, item) => {
    setShowSuggestions(false);
    setSearchTerm("");
    setIsSearchExpanded(false);
    if (type === "product") {
      navigate(`/product/${item.slug}`);
    } else if (type === "category") {
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

  const toggleSearch = () => {
    setIsSearchExpanded(!isSearchExpanded);
    if (!isSearchExpanded) {
      setTimeout(() => searchRef.current?.querySelector("input")?.focus(), 100);
    }
  };

  return (
    <div id="header" className={`header ${isSticky ? "header-sticky" : ""}`}>
      {/* Tier 0: Promo Banner */}
      <PromoBanner />

      {/* Tier 1: Announcement Bar */}
      <AnnouncementBar />

      {/* Tier 2: Main Navigation Bar */}
      <div className="bg-white border-b border-border_light">
        <div className="container">
          <div className="b_header flex items-center justify-between py-3 flex-wrap lg:flex-nowrap gap-4">
            {/* Logo */}
            <div className="flex-shrink-0 order-1">
              <Link to="/" className="logo">
                <img src={Logo} alt="logo" className="xl:w-[90px] w-[70px]" />
              </Link>
            </div>

            {/* Center: Nav Links */}
            <div className="order-2 hidden xl:block flex-1">
              <div className="hidden xl:flex gap-8 text-black text-[16px] font-medium justify-center">
                {menuData.map((menu, index) => {
                    const isActive = location.pathname.startsWith(menu.link);
                    return (
                      <div
                        key={index}
                        className="relative"
                        onMouseEnter={() => menu.subMenu && setActiveMegaMenu(menu.title)}
                        onMouseLeave={() => setActiveMegaMenu(null)}
                      >
                        <Link
                          to={menu.link}
                          className={`flex items-center gap-1 transition-colors ${
                            isActive ? "text-primary" : "text-black hover:text-primary"
                          }`}
                        >
                          {menu.title}
                          {menu.subMenu && (
                            <Icons name="menu_down_arrow" width={12} height={12} color="currentColor" />
                          )}
                        </Link>

                        {activeMegaMenu === menu.title && menu.subMenu && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 bg-white shadow-xl min-w-[280px] py-5 px-6 rounded-lg z-[3] mega-menu-enter">
                            <div className="flex gap-12 justify-between">
                              {menu.subMenu.map((category, catIndex) => (
                                <ul key={catIndex} className="space-y-3">
                                  {category.links.map((item, itemIndex) => (
                                    <li key={itemIndex}>
                                      <Link
                                        to={item.url}
                                        className="text-black font-normal hover:text-primary text-base transition-colors"
                                      >
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

            {/* Right: Icons */}
            <div className="flex items-center gap-5 xl:gap-6 order-3">
              {/* Search */}
              <div className="relative" ref={searchRef}>
                {isSearchExpanded ? (
                  <div className="flex items-center gap-2 search-overlay">
                    <form onSubmit={handleSearch} className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => searchTerm.trim().length > 1 && setShowSuggestions(true)}
                        className="w-64 lg:w-80 bg-gray-100 border-2 border-primary/10 rounded-full py-2.5 px-4 pl-10 pr-20 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none text-black"
                        autoFocus
                      />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <Icons name="search" height={18} width={18} color="currentColor" />
                      </div>
                      <button
                        type="submit"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-opacity-90 transition-all"
                      >
                        Search
                      </button>
                    </form>
                    <button
                      onClick={toggleSearch}
                      className="text-gray-500 hover:text-black transition-colors"
                    >
                      <Icons name="close" width={18} height={18} color="currentColor" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={toggleSearch}
                    className="text-black hover:text-primary transition-colors"
                    aria-label="Search"
                  >
                    <Icons name="search" height={22} width={22} color="currentColor" />
                  </button>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-white shadow-2xl rounded-2xl border border-gray-100 z-[200] overflow-hidden max-h-[400px] overflow-y-auto w-[350px] lg:w-[450px]">
                    {suggestions.products.length === 0 && suggestions.categories.length === 0 && !isSearching ? (
                      <div className="p-8 text-center">
                        <p className="text-gray-400 text-sm font-medium">
                          No results found for "{searchTerm}"
                        </p>
                      </div>
                    ) : (
                      <>
                        {suggestions.categories.length > 0 && (
                          <div className="p-3 border-b border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">
                              Categories
                            </p>
                            <div className="flex flex-wrap gap-2 px-2">
                              {suggestions.categories.map((cat) => (
                                <div
                                  key={cat._id}
                                  onClick={() => handleSuggestionClick("category", cat)}
                                  className="bg-gray-50 hover:bg-primary/10 hover:text-primary transition-colors px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer"
                                >
                                  {cat.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {suggestions.products.length > 0 && (
                          <div className="p-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">
                              Products
                            </p>
                            {suggestions.products.map((prod) => (
                              <div
                                key={prod._id}
                                onClick={() => handleSuggestionClick("product", prod)}
                                className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors cursor-pointer rounded-xl"
                              >
                                <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                  <img
                                    src={getThumbnailImage(prod.images?.[0]?.url)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {prod.name}
                                  </p>
                                  <p className="text-xs text-primary font-bold">
                                    ${prod.priceSale || prod.price}
                                  </p>
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
                      <div className="p-6 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User — HIDDEN when ordering disabled */}
              {!ORDERING_DISABLED && (
                <div
                  className="cursor-pointer hidden xl:block"
                  onClick={handleAccountNavigate}
                >
                  <Icons name="user" height={22} width={22} color="#111111" />
                </div>
              )}

              {/* Wishlist — HIDDEN when ordering disabled */}
              {!ORDERING_DISABLED && isAuthenticated && (
                <div
                  className="relative cursor-pointer hidden xl:block"
                  onClick={() => navigate("/wishlist")}
                >
                  <Icons name="wishlist" height={22} width={22} color="#111111" />
                </div>
              )}

              {/* Cart — HIDDEN when ordering disabled */}
              {!ORDERING_DISABLED && (
                <div
                  className="relative cursor-pointer"
                  onClick={() => navigate("/cart")}
                >
                  <Icons name="cart_bag" height={22} width={22} color="#111111" />
                  {cartCount !== 0 && (
                    <div className="absolute w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center text-[10px] text-white right-[-8px] top-[-6px]">
                      {cartCount}
                    </div>
                  )}
                </div>
              )}

              {/* DoorDash Order Button — SHOWN when ordering disabled */}
              {ORDERING_DISABLED && (
                <a
                  href={DOORDASH_ORDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#B5223B] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition hidden xl:inline-block"
                >
                  Order Now
                </a>
              )}

              {/* Mobile Menu Toggle */}
              <button
                className="xl:hidden text-black"
                aria-label="Toggle navigation"
                onClick={() => setDrawerOpen(true)}
              >
                <Icons name="menu_bar" width={24} height={24} color="#000000" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 z-50`}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <Link to="/" onClick={() => setDrawerOpen(false)}>
            <img src={Logo} alt="logo" className="w-16" />
          </Link>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <Icons name="close" width={18} height={18} color="#000000" />
          </button>
        </div>

        {/* Mobile Search */}
        <div className="p-4 border-b">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 rounded-full py-2.5 px-4 pl-10 text-sm outline-none text-black"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Icons name="search" height={16} width={16} color="currentColor" />
            </div>
          </form>
        </div>

        <nav className="flex flex-col gap-1 p-4 text-black text-[15px] font-medium">
          {menuData.map((menu, index) => (
            <div key={index}>
              {menu.subMenu ? (
                <button
                  className="flex justify-between items-center w-full py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setOpenMenu(openMenu === menu.title ? null : menu.title)}
                >
                  <span>{menu.title}</span>
                  <Icons
                    name="menu_down_arrow"
                    width={12}
                    height={12}
                    color="#000000"
                    className={`transform transition-transform ${openMenu === menu.title ? "rotate-180" : ""}`}
                  />
                </button>
              ) : (
                <Link
                  to={menu.link}
                  className="block py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setDrawerOpen(false)}
                >
                  {menu.title}
                </Link>
              )}
            </div>
          ))}

          {/* Submenu for mobile */}
          {openMenu &&
            menuData
              .filter((menu) => menu.title === openMenu)
              .map((menu) =>
                menu.subMenu?.map((category, catIndex) => (
                  <div key={catIndex} className="pl-4 border-l-2 border-gray-200 ml-2 space-y-1">
                    {category.links.map((item, itemIndex) => (
                      <Link
                        key={itemIndex}
                        to={item.url}
                        className="block py-2 px-3 text-sm text-gray-600 hover:text-primary transition-colors"
                        onClick={() => {
                          setDrawerOpen(false);
                          setOpenMenu(null);
                        }}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                ))
              )}
        </nav>

        {/* Mobile drawer footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500 space-y-1">
            <p>📍 4521 W Coast Hwy, Newport Beach</p>
            <p>📞 (949) 200-9377</p>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => {
            setDrawerOpen(false);
            setOpenMenu(null);
          }}
        ></div>
      )}
    </div>
  );
};

export default Header;
