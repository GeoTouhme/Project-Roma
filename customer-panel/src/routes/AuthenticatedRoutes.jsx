import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "../pages/home";
import Collection from "../pages/collections";
import ProductPage from "../pages/product";
import Cart from "../pages/cart/Cart";
import Billing from "../pages/Billing/Billing";
import Account from "../pages/account/Account";
import Header from "../components/header";
import Footer from "../components/footer";
import MobileBottomNav from "../components/mobile-bottom-nav";
import { useSelector } from "react-redux";
import OrderPage from "../pages/order";
import OrdersPage from "../pages/orders";
import WishlistPage from "../pages/wishlist";
import Terms from "../pages/Terms/Terms";
import Privacy from "../pages/Privacy/Privacy";
import { ORDERING_DISABLED } from "../config/orderingConfig";

const AuthenticatedRoutes = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  return (
    <div id="home" className="home">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/wine/*" element={<Collection />} />
        <Route path="/products/*" element={<Collection />} />
        <Route path="/product/*" element={<ProductPage />} />
        <Route path="/cart" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Cart />} />
        <Route path="/billing" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Billing />} />
        <Route path="/order/:id" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <OrderPage />} />
        <Route path="/orders" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <OrdersPage />} />
        <Route path="/wishlist" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <WishlistPage />} />
        <Route path="/terms-and-conditions" element={<Terms />} />
        <Route path="/privacy-policy" element={<Privacy />} />
        <Route path="/account" element={isAuthenticated ? <Account /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default AuthenticatedRoutes;
