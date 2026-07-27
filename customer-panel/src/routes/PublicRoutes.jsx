import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Header from "../components/header";
import Footer from "../components/footer";
import MobileBottomNav from "../components/mobile-bottom-nav";
import Home from "../pages/home";
import Collection from "../pages/collections";
import ProductPage from "../pages/product";
import Cart from "../pages/cart/Cart";
import Register from "../pages/auth/Register";
import Login from "../pages/auth/Login";
import VerifyEmail from "../pages/auth/VerifyEmail";
import Terms from "../pages/Terms/Terms";
import Privacy from "../pages/Privacy/Privacy";
import { ORDERING_DISABLED } from "../config/orderingConfig";

const PublicRoutes = () => {
  return (
    <div id="home" className="home">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/login" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/terms-and-conditions" element={<Terms />} />
        <Route path="/privacy-policy" element={<Privacy />} />
        <Route path="/category/wine/*" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Collection />} />
        <Route path="/products/*" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Collection />} />
        <Route path="/product/*" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <ProductPage />} />
        <Route path="/cart" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <Cart />} />
        <Route path="/verify-otp" element={ORDERING_DISABLED ? <Navigate to="/" replace /> : <VerifyEmail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default PublicRoutes;
