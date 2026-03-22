import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../assets/images/Logo.png";
import Icons from "../svg";
import Skeleton from "react-loading-skeleton";
import { useLocation } from "react-router-dom";
import CategoriesService from "../../services/categoriesService";
import CategoryBar from "./CategoryBar";

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
  const location = useLocation();
  const navigate = useNavigate();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const isAuthenticated = JSON.parse(localStorage.getItem("isAuthenticated"));

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
        console.log("response.data ", response);
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
          console.log("formattedData=  ", formattedData);

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
            <Link to="tel:+19492009377" className="text-[15px] relative">
              (+1) 949-200-9377
            </Link>
            <Link to="mailto:balport@gmail.com" className="text-[15px] relative">
              balport@gmail.com
            </Link>
            <div className="text-[15px] relative hidden md:block">4521 W Coast Hwy, Newport Beach, CA</div>
          </div>
        </div>
      </div>
      <div className="bottom_header">
        <div className="container">
          <div className="b_header flex items-center justify-between py-2.5">
            <div className="bottom_header_left">
              <Link to="/" className="logo">
                {/* {loading && <Skeleton width={90} height={36} />} */}
                <img
                  src={Logo}
                  alt="logo"
                  className={`xl:w-[90px] w-[60px]`}
                // onLoad={() => setLoading(false)}
                />
              </Link>
            </div>
            <div className="bottom_header_center">
              <div className="hidden relative xl:flex gap-7 text-black text-[18px] font-medium">
                {loading ? (
                  // Skeleton loader for menu items
                  [...Array(6)].map((_, index) => (
                    <div key={index} className="flex flex-col items-start gap-2">
                      <Skeleton width={150} height={20} />
                      {/* <Skeleton width={100} height={20} /> */}
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
                  className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform ${isDrawerOpen ? "translate-x-0" : "-translate-x-full"
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
                  className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform ${openMenu ? "translate-x-0" : "-translate-x-full"
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
              <div className="header_user cursor-pointer" onClick={handleAccountNavigate}>
                <Icons name="user" height={20} width={20} color="#111111" />
              </div>
              {isAuthenticated && <div className="header_wishlist relative cursor-pointer" onClick={() => navigate("/wishlist")}>
                <Icons name="wishlist" height={20} width={20} color="#111111" />
                {/* <div className="wishlist_count absolute w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center text-[10px] text-white right-[-10px] top-[-6px]">
                  0
                </div> */}
              </div>}
              <div className="header_cart relative cursor-pointer" onClick={() => navigate("/cart")}>
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
      {
    (location.pathname === '/products' || location.pathname.startsWith('/products/')) && (
      <CategoryBar categories={categoryData} />
    )
  }
    </div >
  );
};

export default Header;
