import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/lib/toast";
import { authAPI } from "@/lib/api";

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; tempToken?: string }>;
  verifyMfa: (tempToken: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = () => {
      const savedUser = localStorage.getItem("admin_user");

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const formatUser = (userData: any): User => ({
    _id: userData._id,
    firstName: userData.firstName,
    lastName: userData.lastName,
    name: `${userData.firstName} ${userData.lastName}`,
    email: userData.email,
    role: userData.role,
    avatar: (typeof userData.cover === 'string' ? userData.cover : userData.cover?.url) || `https://ui-avatars.com/api/?name=${userData.firstName}+${userData.lastName}&background=0D8ABC&color=fff`,
  });

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      console.log("[login] response:", response.status, response.data);

      if (response.data.success) {
        // 🛡️ MFA: credentials valid but TOTP code still required.
        if (response.data.mfaRequired) {
          return { mfaRequired: true, tempToken: response.data.tempToken };
        }

        const userData = response.data.user;

        // Check if user is admin or super admin
        if (userData.role !== 'admin' && userData.role !== 'super admin') {
          toast.error("Access denied. Admin privileges required.");
          return { mfaRequired: false };
        }

        const formattedUser = formatUser(userData);

        localStorage.setItem("admin_user", JSON.stringify(formattedUser));
        setUser(formattedUser);
        toast.success("Login successful");
        navigate("/dashboard");
        return { mfaRequired: false };
      } else {
        toast.error(response.data.message || "Login failed");
        return { mfaRequired: false };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "An error occurred during login";
      toast.error(errorMessage);
      console.error("Login error:", error);
      return { mfaRequired: false };
    }
  };

  const verifyMfa = async (tempToken: string, code: string) => {
    try {
      const response = await authAPI.verifyMfa(tempToken, code);
      console.log("[verifyMfa] response:", response.status, response.data);

      if (response.data.success) {
        const userData = response.data.user;

        if (userData.role !== 'admin' && userData.role !== 'super admin') {
          toast.error("Access denied. Admin privileges required.");
          return;
        }

        const formattedUser = formatUser(userData);

        localStorage.setItem("admin_user", JSON.stringify(formattedUser));
        setUser(formattedUser);
        toast.success("Login successful");
        navigate("/dashboard");
      } else {
        toast.error(response.data.message || "MFA verification failed");
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Invalid MFA code";
      toast.error(errorMessage);
      console.error("MFA verify error:", error);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("admin_user");
      setUser(null);
      toast.success("Logged out successfully");
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        verifyMfa,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;
