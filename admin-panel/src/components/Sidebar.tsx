import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  User,
  LogOut,
  ChevronRight,
  Layers2,
  Layers,
  Mail,
  Clock,
  BarChart3,
  Tags,
} from "lucide-react";

interface SidebarProps {
  collapsed?: boolean;
  setSidebarOpen?: any;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname.includes(to);

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center py-3 px-4 rounded-lg text-sm font-medium",
        "transition-all duration-200 group",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <div className="mr-3">{icon}</div>
      {!collapsed && <span>{label}</span>}
      {isActive && !collapsed && <ChevronRight className="w-4 h-4 ml-auto" />}
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  setSidebarOpen,
}) => {
  const { logout, user } = useAuth();

  return (
    <div
      className={cn(
        "h-screen flex flex-col bg-sidebar border-r border-sidebar-border shadow-lg",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-[280px]"
      )}
    >
      {/* Logo */}
      <div
        className="p-4 flex items-center gap-3 border-b border-sidebar-border/50 cursor-pointer"
        onClick={() => setSidebarOpen(true)}
      >
        <div className="flex items-center justify-center bg-primary rounded-lg w-10 h-10">
          <User className="w-6 h-6 text-white" />
        </div>
        {!collapsed && (
          <div className="font-bold text-sidebar-foreground text-xl">Admin</div>
        )}
      </div>

      {/* User info */}
      <div className="p-4 border-b border-sidebar-border/50 flex items-center gap-3">
        <div className="flex-shrink-0">
          <img
            src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=0D8ABC&color=fff`}
            alt={user?.name}
            className="w-10 h-10 rounded-full border-2 border-sidebar-border"
          />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-semibold truncate text-sidebar-foreground">
              {user?.name}
            </div>
            <div className="text-xs truncate text-sidebar-foreground/70">
              {user?.email}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          <NavItem
            to="/dashboard"
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
            collapsed={collapsed}
          />
          <NavItem
            to="/orders"
            icon={<ShoppingBag className="w-5 h-5" />}
            label="Orders"
            collapsed={collapsed}
          />
          <NavItem
            to="/products"
            icon={<Package className="w-5 h-5" />}
            label="Products"
            collapsed={collapsed}
          />
          <NavItem
            to="/categories"
            icon={<Layers2 className="w-5 h-5" />}
            label="Main Categories"
            collapsed={collapsed}
          />
          <NavItem
            to="/sub-categories"
            icon={<Layers className="w-5 h-5" />}
            label="Sub Categories"
            collapsed={collapsed}
          />
          <NavItem
            to="/customers"
            icon={<Users className="w-5 h-5" />}
            label="Customers"
            collapsed={collapsed}
          />
          <NavItem
            to="/newsletters"
            icon={<Mail className="w-5 h-5" />}
            label="Newsletters"
            collapsed={collapsed}
          />
          <NavItem
            to="/deals"
            icon={<Tags className="w-5 h-5" />}
            label="Deals"
            collapsed={collapsed}
          />
          <NavItem
            to="/store-settings"
            icon={<Clock className="w-5 h-5" />}
            label="Store Settings"
            collapsed={collapsed}
          />
          <NavItem
            to="/analytics"
            icon={<BarChart3 className="w-5 h-5" />}
            label="Analytics"
            collapsed={collapsed}
          />
          <NavItem
            to="/account"
            icon={<User className="w-5 h-5" />}
            label="My Account"
            collapsed={collapsed}
          />
        </div>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border/50">
        <button
          onClick={logout}
          className={cn(
            "flex items-center w-full py-3 px-4 rounded-lg text-sm font-medium",
            "transition-all duration-200 group",
            "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          )}
        >
          <LogOut className="w-5 h-5 mr-3" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};
