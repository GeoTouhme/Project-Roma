import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import "react-loading-skeleton/dist/skeleton.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "./App.css";
import PublicRoutes from "./routes/PublicRoutes";
import AuthenticatedRoutes from "./routes/AuthenticatedRoutes";
import { Provider, useSelector } from "react-redux";
import store from "./redux/store";
import { Toaster } from "react-hot-toast";
import ScrollToTop from "./components/scroll-to-top/ScrollToTop";
import AgeGate from "./components/age-gate/AgeGate";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { STRIPE_PUBLIC_KEY } from "./config/AppConfig";
import MaintenancePage from "./components/maintenance/MaintenancePage";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { fetchStoreStatus } from "./redux/storeStatusSlice";
import { ORDERING_DISABLED } from "./config/orderingConfig";
import { trackPageView } from "./services/analyticsService";

const MAINTENANCE = process.env.REACT_APP_MAINTENANCE_MODE === 'true';

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let pageType = 'page';
    let slug = path;

    if (path === '/' || path === '') {
      pageType = 'home';
      slug = 'home';
    } else if (path.startsWith('/product/')) {
      pageType = 'product';
      slug = path.split('/').pop() || 'product';
    } else if (path.startsWith('/collections')) {
      pageType = 'collections';
      slug = 'collections';
    } else if (path.startsWith('/cart')) {
      pageType = 'cart';
      slug = 'cart';
    } else if (path.startsWith('/orders')) {
      pageType = 'orders';
      slug = 'orders';
    } else if (path.startsWith('/account')) {
      pageType = 'account';
      slug = 'account';
    }

    trackPageView(pageType, { slug, name: pageType });
  }, [location]);

  return null;
};

const AppRoutes = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  return (
    <>
      <PageTracker />
      <Routes>
        {isAuthenticated && <Route path="/*" element={<AuthenticatedRoutes />} />}
        <Route path="/*" element={<PublicRoutes />} />
      </Routes>
    </>
  );
};

const AppContent = () => {
  const dispatch = useDispatch();
  const { isOpen, message } = useSelector((state) => state.storeStatus);

  useEffect(() => {
    dispatch(fetchStoreStatus());
  }, [dispatch]);

  return (
    <>
      {!isOpen && (
        <div className="bg-red-600 text-white py-2 px-4 text-center text-sm font-medium z-50 relative">
          {message || "The store is currently closed."}
        </div>
      )}
      <AgeGate />
      <ScrollToTop />
      <Toaster />
      <AppRoutes />
    </>
  );
};

function App() {
  if (MAINTENANCE) {
    return <MaintenancePage />;
  }

  return (
    <Provider store={store}>
      {ORDERING_DISABLED ? (
        <Router>
          <AppContent />
        </Router>
      ) : (
        <Elements stripe={stripePromise}>
          <Router>
            <AppContent />
          </Router>
        </Elements>
      )}
    </Provider>
  );
}

export default App;
