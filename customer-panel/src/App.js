import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
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

const MAINTENANCE = process.env.REACT_APP_MAINTENANCE_MODE === 'true';

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

const AppRoutes = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  return (
    <Routes>
      {isAuthenticated && <Route path="/*" element={<AuthenticatedRoutes />} />}
      <Route path="/*" element={<PublicRoutes />} />
    </Routes>
  );
};

function App() {
  if (MAINTENANCE) {
    return <MaintenancePage />;
  }

  return (
    <Provider store={store}>
      <Elements stripe={stripePromise}>
        <Router>
          <AgeGate />
          <ScrollToTop />
          <Toaster />
          <AppRoutes />
        </Router>
      </Elements>
    </Provider>
  );
}

export default App;
