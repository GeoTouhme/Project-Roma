import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Navigate, Outlet } from "react-router-dom";

export const Layout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // If authentication is still loading, show a loading state
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin-slow w-16 h-16 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <div
        className={`fixed md:relative z-20 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "left-0" : "-left-[280px] md:left-0 md:w-20"
        }`}
      >
        <Sidebar
          collapsed={!sidebarOpen && window.innerWidth >= 768}
          setSidebarOpen={setSidebarOpen}
        />
        {sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className={`fixed md:absolute top-4 left-4 md:left-auto right-auto md:right-4 z-30 p-2 rounded-full bg-primary/10 text-white hover:bg-primary/20 transition-all`}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 transition-all duration-300">
        {/* Mobile nav toggle */}

        {/* Content */}
        <main className="h-full overflow-y-auto px-4 py-4 md:p-6 w-full flex justify-center animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
