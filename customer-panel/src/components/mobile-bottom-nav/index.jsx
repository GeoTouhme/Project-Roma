import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Icons from "../svg";

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const navItems = [
    { name: "Home", icon: "home", link: "/" },
    { name: "Shop", icon: "products", link: "/products" },
    { name: "Wishlist", icon: "wishlist", link: "/wishlist" },
    { name: "Account", icon: "user", link: "/account" },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-[100] px-4 md:hidden">
      <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
        {/* Main Pill Bar */}
        <div className="flex-1 bg-white/90 backdrop-blur-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 rounded-full h-16 flex items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.link;
            return (
              <Link
                key={item.name}
                to={item.link}
                className={`flex items-center gap-2 transition-all duration-300 ${
                  isActive ? "bg-[#F3F4F6] px-4 py-2.5 rounded-full" : "px-3 py-2"
                }`}
              >
                <Icons
                  name={isActive && item.icon === 'wishlist' ? 'fill_wishlist' : item.icon}
                  width={22}
                  height={22}
                  color={isActive ? "#000000" : "#9CA3AF"}
                />
                {isActive && (
                  <span className="text-[14px] font-bold text-black tracking-tight">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Floating Cart Button */}
        <div 
          onClick={() => navigate("/cart")}
          className="relative bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full w-16 h-16 flex items-center justify-center cursor-pointer border border-white/50"
        >
          <Icons name="cart_bag" width={24} height={24} color="#000000" />
          {cartCount > 0 && (
            <div className="absolute top-3 right-3 bg-[#B5223B] text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              {cartCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileBottomNav;
