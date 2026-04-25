import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Header from "../components/header";
import Footer from "../components/footer";
import MobileBottomNav from "../components/mobile-bottom-nav";
import Home from "../pages/home";
import Collection from "../pages/collections";
import ProductPage from "../pages/product";
import Cart from "../pages/cart/Cart";
import Billing from "../pages/Billing/Billing";
import Register from "../pages/auth/Register";
import Login from "../pages/auth/Login";
import VerifyEmail from "../pages/auth/VerifyEmail";
import Terms from "../pages/Terms/Terms";
import Privacy from "../pages/Privacy/Privacy";
import { useSelector } from "react-redux";

const PublicRoutes = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  return (
    <div id="home" className="home">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/terms-and-conditions" element={<Terms />} />
        <Route path="/privacy-policy" element={<Privacy />} />
        <Route path="/category/wine/*" element={<Collection />} />
        <Route path="/products/*" element={<Collection />} />
        <Route path="/product/*" element={<ProductPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/verify-otp" element={<VerifyEmail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default PublicRoutes;
