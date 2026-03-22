import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../assets/images/Logo.png";
import Icons from "../svg";
import Skeleton from "react-loading-skeleton";
import { useLocation } from "react-router-dom";

const Header = () => {
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false); // Mobile Main Menu
  const [openMenu, setOpenMenu] = useState(null); // Mobile Mega Menu
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const menuData = [
    { title: "Home", link: "/" },
    {
      title: "Wine",
      link: "/category/wine",
      subMenu: [
        {
          category: "Categories",
          links: [
            { name: "Red Wine", url: "/category/wine/red-wine" },
            { name: "White Wine", url: "/category/wine/white-wine" },
            { name: "Rose & Blush Wine", url: "/category/wine/rose-blush-wine" },
            { name: "Champagne", url: "/category/wine/champagne" },
            { name: "Sparkling Wine", url: "/category/wine/sparkling-wine" },
            { name: "Dessert & Fortified Wine", url: "/category/wine/dessert-fortified-wine" },
          ],
        },
        {
          category: "Types",
          links: [
            { name: "Cabernet Sauvignon", url: "/category/wine/cabernet-sauvignon" },
            { name: "Chardonnay", url: "/category/wine/chardonnay" },
            { name: "Merlot", url: "/category/wine/merlot" },
            { name: "Muscat/Moscato", url: "/category/wine/muscat-moscato" },
            { name: "Pinot Grigio/Pinot Gris", url: "/category/wine/pinot-grigio-pinot-gris" },
            { name: "Pinot Noir", url: "/category/wine/pinot-noir" },
            { name: "Red Blend", url: "/category/wine/red-blend" },
            { name: "Riesling", url: "/category/wine/riesling" },
          ],
        },
        {
          category: "Brands",
          links: [
            { name: "Barefoot", url: "/category/wine/barefoot" },
            { name: "Bota Box", url: "/category/wine/bota-box" },
            { name: "Gallo", url: "/category/wine/gallo" },
            { name: "Kendall-Jackson", url: "/category/wine/kendall-jackson" },
            { name: "Kim Crawford", url: "/category/wine/kim-crawford" },
            { name: "Napa Cellars", url: "/category/wine/napa-cellars" },
            { name: "Oyster Bay", url: "/category/wine/oyster-bay" },
            { name: "Veuve Clicquot", url: "/category/wine/veuve-clicquot" },
          ],
        },
        {
          category: "Country",
          links: [
            { name: "Argentina", url: "/category/wine/argentina" },
            { name: "Australia", url: "/category/wine/australia" },
            { name: "France", url: "/category/wine/france" },
            { name: "Italy", url: "/category/wine/italy" },
            { name: "Spain", url: "/category/wine/spain" },
            { name: "United States", url: "/category/wine/united-states" },
          ],
        },
      ],
    },
    {
      title: "Beer",
      link: "/category/wine",
      subMenu: [
        {
          category: "Categories",
          links: [
            { name: "Domestic Beer", url: "/category/wine/domestic-beer" },
            { name: "Imported Beer", url: "/category/wine/imported-beer" },
            { name: "Craft Beer", url: "/category/wine/craft-beer" },
            { name: "Non Alcoholic Beer", url: "/category/wine/non-alcoholic-beer" },
          ],
        },
        {
          category: "Types",
          links: [
            { name: "Ale", url: "/category/wine/ale" },
            { name: "Lager", url: "/category/wine/lager" },
            { name: "American Amber Ale", url: "/category/wine/american-amber-ale" },
            { name: "American IPA", url: "/category/wine/american-ipa" },
            { name: "American Pale Ale", url: "/category/wine/american-pale-ale" },
            { name: "German-Style Pilsner", url: "/category/wine/german-style-pilsner" },
            { name: "Porter/American Porter", url: "/category/wine/porter-american-porter" },
          ],
        },
        {
          category: "Brands",
          links: [
            { name: "Budweiser", url: "/category/wine/budweiser" },
            { name: "Bud Light", url: "/category/wine/bud-light" },
            { name: "Corona", url: "/category/wine/corona" },
            { name: "Heineken", url: "/category/wine/heineken" },
            { name: "Beck’s", url: "/category/wine/becks" },
            { name: "Stella Artois", url: "/category/wine/stella-artois" },
            { name: "Coors", url: "/category/wine/coors" },
          ],
        },
        {
          category: "Country",
          links: [
            { name: "United States", url: "/category/wine/united-states" },
            { name: "Belgium", url: "/category/wine/belgium" },
            { name: "England", url: "/category/wine/england" },
            { name: "Germany", url: "/category/wine/germany" },
            { name: "Ireland", url: "/category/wine/ireland" },
            { name: "Mexico", url: "/category/wine/mexico" },
          ],
        },
      ],
    },
    {
      title: "Spirits",
      link: "/category/wine",
      subMenu: [
        {
          category: "Categories",
          links: [
            { name: "Whiskey", url: "/category/wine/whiskey" },
            { name: "Vodka", url: "/category/wine/vodka" },
            { name: "Rum", url: "/category/wine/rum" },
            { name: "Tequila", url: "/category/wine/tequila" },
            { name: "Gin", url: "/category/wine/gin" },
            { name: "Brandy & Cognac", url: "/category/wine/brandy-cognac" },
            { name: "Liqueurs & Cordials", url: "/category/wine/liqueurs-cordials" },
          ],
        },
        {
          category: "Popular Brands",
          links: [
            { name: "Jack Daniel’s", url: "/category/wine/jack-daniels" },
            { name: "Johnnie Walker", url: "/category/wine/johnnie-walker" },
            { name: "Grey Goose", url: "/category/wine/grey-goose" },
            { name: "Patrón", url: "/category/wine/patron" },
            { name: "Captain Morgan", url: "/category/wine/captain-morgan" },
            { name: "Hennessy", url: "/category/wine/hennessy" },
            { name: "Baileys", url: "/category/wine/baileys" },
          ],
        },
        {
          category: "Aged & Premium",
          links: [
            { name: "Single Malt Scotch", url: "/category/wine/single-malt-scotch" },
            { name: "Añejo Tequila", url: "/category/wine/anejo-tequila" },
            { name: "XO Cognac", url: "/category/wine/xo-cognac" },
            { name: "Small Batch Bourbon", url: "/category/wine/small-batch-bourbon" },
            { name: "Ultra-Premium Vodka", url: "/category/wine/ultra-premium-vodka" },
          ],
        },
        {
          category: "Origin",
          links: [
            { name: "Scottish Whisky", url: "/category/wine/scottish-whisky" },
            { name: "Irish Whiskey", url: "/category/wine/irish-whiskey" },
            { name: "American Bourbon", url: "/category/wine/american-bourbon" },
            { name: "Mexican Tequila", url: "/category/wine/mexican-tequila" },
            { name: "French Cognac", url: "/category/wine/french-cognac" },
            { name: "Caribbean Rum", url: "/category/wine/caribbean-rum" },
          ],
        },
      ],
    },
    { title: "Mixers", link: "/category/wine/mixers" },
    { title: "Cocktails", link: "/category/wine/cocktails" },
    { title: "Gift Ideas", link: "/category/wine/gift-idea" },
  ];

  return (
    <div id="header" className="header">
      <div className="top_header">
        <div className="container">
          <div className="top_header_left py-3 flex items-center border-b border-border_color">
            <Link to="tel:7045645202" className="text-[15px] relative">
              70456 45202
            </Link>
            <Link to="mailto:support@gmail.com" className="text-[15px] relative">
              support@gmail.com
            </Link>
            <div className="text-[15px] relative hidden md:block">894 Main Street, Waltham, MA 02453</div>
          </div>
        </div>
      </div>
      <div className="bottom_header">
        <div className="container">
          <div className="b_header flex items-center justify-between py-2.5">
            <div className="bottom_header_left">
              <Link to="/" className="logo">
                {loading && <Skeleton width={90} height={36} />}
                <img
                  src={Logo}
                  alt="logo"
                  className={`xl:w-[90px] w-[60px] ${loading ? "hidden" : "block"}`}
                  onLoad={() => setLoading(false)}
                />
              </Link>
            </div>
            <div className="bottom_header_center">
              <div className="hidden relative xl:flex gap-7 text-black text-[18px] font-medium">
                {menuData.map((menu, index) => {
                  // const isActive = location.pathname === menu.link;
                  const isActive = location.pathname.startsWith(menu.link);

                  return (
                    <div
                      key={index}
                      className=""
                      onMouseEnter={() => menu.subMenu && setActiveMegaMenu(menu.title)}
                      onMouseLeave={() => setActiveMegaMenu(null)}
                    >
                      <Link to={menu.link} className={`flex items-center gap-1 ${isActive ? "text-primary" : ""}`}>
                        {menu.title}{" "}
                        {menu.subMenu && <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />}
                      </Link>

                      {/* Mega Menu for Desktop */}
                      {activeMegaMenu === menu.title && menu.subMenu && (
                        <div className="absolute left-[50%] translate-x-[-50%] top-full bg-white shadow-lg w-[900px] py-4 px-6 rounded-lg z-[3]">
                          <div className="flex gap-10 justify-between">
                            {menu.subMenu.map((category, catIndex) => (
                              <div key={catIndex}>
                                <h4 className="megamenu_col_title relative font-semibold text-primary text-lg mb-4">
                                  {category.category}
                                </h4>
                                <ul className="space-y-1">
                                  {category.links.map((item, itemIndex) => (
                                    <li key={itemIndex}>
                                      <Link
                                        to={item.url}
                                        className="text-black font-normal hover:text-black-500 text-base"
                                      >
                                        {item.name}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bottom_header_right flex items-center gap-4 xl:gap-6">
              <div className="mobile_menu  pt-1">
                <button
                  className="xl:hidden text-white"
                  aria-label="Toggle navigation"
                  onClick={() => setDrawerOpen(true)}
                >
                  <Icons name="menu_bar" width={20} height={20} color="#000000" />
                </button>

                {/* Main Drawer (First Level) */}
                <div
                  className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform ${
                    isDrawerOpen ? "translate-x-0" : "-translate-x-full"
                  } transition-transform duration-300 z-50`}
                >
                  {/* Close Button */}
                  <div className="flex justify-between p-4 border-b ">
                    <span className="font-semibold text-lg"></span>
                    <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                      <Icons name="close" width={12} height={12} color="#000000" />
                    </button>
                  </div>

                  {/* Main Menu */}
                  <nav className="flex flex-col gap-4 p-6 text-black text-[16px] font-medium">
                    {menuData.map((menu, index) => (
                      <div key={index}>
                        {/* Check if the menu has a subMenu */}
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

                {/* Mega Menu Drawer (Second Level) */}
                <div
                  className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform ${
                    openMenu ? "translate-x-0" : "-translate-x-full"
                  } transition-transform duration-300 z-50`}
                >
                  {/* Back Button */}
                  <div className="flex items-center p-4 border-b ">
                    <button onClick={() => setOpenMenu(null)} aria-label="Back" className="back_btn">
                      <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />
                    </button>
                    <span className="ml-4 font-medium text-base/[16px]">{openMenu}</span>
                  </div>

                  {/* Mega Menu Content */}
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

                {/* Overlay */}
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
              <div className="header_search">
                <Icons name="search" height={20} width={20} color="#111111" />
              </div>
              <div className="header_user cursor-pointer" onClick={() => navigate("/account")}>
                <Icons name="user" height={20} width={20} color="#111111" />
              </div>
              <div className="header_wishlist relative">
                <Icons name="wishlist" height={20} width={20} color="#111111" />
                <div className="wishlist_count absolute w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center text-[10px] text-white right-[-10px] top-[-6px]">
                  0
                </div>
              </div>
              <div className="header_cart relative cursor-pointer" onClick={() => navigate("/cart")}>
                <Icons name="cart_bag" height={20} width={20} color="#111111" />
                <div
                  className="cart_count absolute w-[18px] h-[18px] rounded-full bg-primary
                flex items-center justify-center text-[10px] text-white right-[-10px] top-[-6px]"
                >
                  0
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
