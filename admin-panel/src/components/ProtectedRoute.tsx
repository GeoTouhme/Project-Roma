import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  element: JSX.Element;
}

export const ProtectedRoute = ({ element }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // or a loading spinner

  return isAuthenticated ? element : <Navigate to="/login" replace />;
};

export const RedirectIfAuthenticated = ({ element }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return isAuthenticated ? <Navigate to="/dashboard" /> : element;
};
