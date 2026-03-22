import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "react-loading-skeleton/dist/skeleton.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "./App.css";
import PublicRoutes from "./routes/PublicRoutes";
// import Home from "./pages/home";
// import Collection from "./pages/collections";
// import ProductPage from "./pages/product";
// import Cart from "./pages/cart/Cart";
// import Billing from "./pages/Billing/Billing";
// import Account from "./pages/account/Account";

function App() {
  return (
    <Router>
      <PublicRoutes />
      {/* <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/wine" element={<Collection />} />
        <Route path="/product/1" element={<ProductPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/account" element={<Account />} />
      </Routes> */}
    </Router>
  );
}

export default App;
