import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Header from "../components/header";
import Footer from "../components/footer";
import Home from "../pages/home";
import Collection from "../pages/collections";
import ProductPage from "../pages/product";
import Cart from "../pages/cart/Cart";
import Billing from "../pages/Billing/Billing";
import Account from "../pages/account/Account";

const PublicRoutes = () => {
  return (
    <div id="home" className="home">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/wine/*" element={<Collection />} />
        <Route path="/product/1" element={<ProductPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/account" element={<Account />} />
      </Routes>
      <Footer />
    </div>
  );
};

export default PublicRoutes;
