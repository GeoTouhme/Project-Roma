import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Products from "./pages/Products";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import {
  ProtectedRoute,
  RedirectIfAuthenticated,
} from "@/components/ProtectedRoute";
import ProductDetail from "./pages/ProductDetail";
import ProductForm from "./pages/ProductForm";
import Customers from "./pages/Customers";
import CustomerForm from "./pages/CustomerForm";
import CustomerDetail from "./pages/CustomerDetail";
import MyAccount from "./pages/MyAccount";
import MainCategories from "./pages/MainCategories";
import MainCategoryForm from "./pages/MainCategoryForm";
import SubCategories from "./pages/SubCategories";
import SubCategoryForm from "./pages/SubCategoryForm";
import Newsletters from "./pages/Newsletters";
import StoreSettings from "./pages/StoreSettings";
import Analytics from "./pages/Analytics";
import Deals from "./pages/Deals";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public route */}

            {/* Redirect to dashboard if already logged in */}
            <Route
              path="/login"
              element={<RedirectIfAuthenticated element={<Login />} />}
            />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={<ProtectedRoute element={<Layout />} />}
            >
              <Route index element={<Dashboard />} />
            </Route>
            <Route path="/" element={<ProtectedRoute element={<Layout />} />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="products" element={<Products />} />
              <Route
                path="/products/:id"
                element={<ProtectedRoute element={<ProductDetail />} />}
              />
              <Route
                path="/products/edit/:id"
                element={<ProtectedRoute element={<ProductForm />} />}
              />
              <Route
                path="/products/new"
                element={<ProtectedRoute element={<ProductForm />} />}
              />
              <Route
                path="/customers"
                element={<ProtectedRoute element={<Customers />} />}
              />
              <Route
                path="/customers/:id"
                element={<ProtectedRoute element={<CustomerDetail />} />}
              />

              <Route
                path="/customers/new"
                element={<ProtectedRoute element={<CustomerForm />} />}
              />
              <Route
                path="/customers/edit/:id"
                element={<ProtectedRoute element={<CustomerForm />} />}
              />
              <Route
                path="/account"
                element={<ProtectedRoute element={<MyAccount />} />}
              />
              <Route
                path="/categories"
                element={<ProtectedRoute element={<MainCategories />} />}
              />
              <Route
                path="/categories/new"
                element={<ProtectedRoute element={<MainCategoryForm />} />}
              />
              <Route
                path="/categories/:id"
                element={<ProtectedRoute element={<MainCategoryForm />} />}
              />
              <Route
                path="/sub-categories"
                element={<ProtectedRoute element={<SubCategories />} />}
              />
              <Route
                path="/sub-categories/new"
                element={<ProtectedRoute element={<SubCategoryForm />} />}
              />
              <Route
                path="/sub-categories/:id"
                element={<ProtectedRoute element={<SubCategoryForm />} />}
              />
              <Route
                path="/newsletters"
                element={<ProtectedRoute element={<Newsletters />} />}
              />
              <Route
                path="/store-settings"
                element={<ProtectedRoute element={<StoreSettings />} />}
              />
              <Route
                path="/analytics"
                element={<ProtectedRoute element={<Analytics />} />}
              />
              <Route
                path="/deals"
                element={<ProtectedRoute element={<Deals />} />}
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
