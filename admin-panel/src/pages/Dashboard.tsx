import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatsCard } from "@/components/StatsCard";
import { DashboardCard } from "@/components/DashboardCard";
import { Table } from "@/components/Table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { dashboardAPI, ordersAPI } from "@/lib/api";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
};

const calculateTrend = (current: number, previous: number) => {
  if (!previous || previous === 0) {
    return current > 0 ? { value: 100, isPositive: true } : { value: 0, isPositive: true };
  }
  const diff = ((current - previous) / previous) * 100;
  return { value: Math.round(Math.abs(diff)), isPositive: diff >= 0 };
};

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, ordersRes] = await Promise.all([
          dashboardAPI.getAnalytics(),
          ordersAPI.getOrders({ limit: 5 }),
        ]);

        if (analyticsRes.data.success) {
          setAnalytics(analyticsRes.data.data);
        }
        if (ordersRes.data.success) {
          setRecentOrders(ordersRes.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading dashboard data...</div>;
  }

  // Process sales data for chart
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const salesData = analytics?.incomeReport?.year?.map((value: number, index: number) => ({
    name: months[index],
    value: value || 0
  })) || [];

  // Sparkline data from monthly report
  const revenueSparkline = analytics?.incomeReport?.month?.map((value: number, index: number) => ({
    name: `Day ${index + 1}`,
    value: value || 0
  })) || [];

  // Order status data for chart
  const orderStatuses = ['Pending', 'Processing', 'Delivered', 'Returned', 'Cancelled'];
  const orderStatusData = analytics?.ordersReport?.map((value: number, index: number) => ({
    name: orderStatuses[index],
    value: value || 0
  })) || [];

  // Top selling products
  const topSellingProducts = analytics?.bestSellingProducts?.map((product: any) => ({
    id: product._id,
    name: product.name,
    sold: product.sold,
    revenue: formatPrice(product.sold * (product.priceSale || product.price || 0))
  })) || [];

  // Trends
  const revenueTrend = calculateTrend(analytics?.dailyEarning, analytics?.yesterdayEarning);
  const ordersTrend = calculateTrend(analytics?.dailyOrders, analytics?.yesterdayOrders);
  const usersTrend = calculateTrend(analytics?.newUsersToday, analytics?.newUsersYesterday);

  return (
    <div className="space-y-8 w-full">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] || 'Admin'}`}
        description="Here's what's happening with your store today."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Revenue"
          value={formatPrice(analytics?.dailyEarning || 0)}
          description="vs. Yesterday"
          trend={revenueTrend}
          color="hsl(var(--primary))"
          data={revenueSparkline}
        />

        <StatsCard
          title="Today's Orders"
          value={analytics?.dailyOrders?.toString() || "0"}
          description="vs. Yesterday"
          trend={ordersTrend}
          color="hsl(221, 83%, 53%)"
          data={[]} // Let it generate dummy for now or map another metric
        />

        <StatsCard
          title="Total Customers"
          value={analytics?.users?.toString() || "0"}
          description="New users growth"
          trend={usersTrend}
          color="hsl(142, 71%, 45%)"
          data={[]}
        />

        <StatsCard
          title="Total Products"
          value={analytics?.totalProducts?.toString() || "0"}
          description="Active inventory items"
          trend={{ value: 0, isPositive: true }}
          color="hsl(250, 95%, 64%)"
          data={[]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Overview Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Sales Overview (Monthly)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={salesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatPrice(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Orders by Status Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Orders by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={orderStatusData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="Orders"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard
          title="Pending Orders"
          value={analytics?.ordersReport?.[0]?.toString() || "0"}
          description="Waiting for processing"
          icon={<Clock className="h-4 w-4" />}
          trend={{ value: 0, isPositive: true }}
        />
        <DashboardCard
          title="Delivered Orders"
          value={analytics?.ordersReport?.[2]?.toString() || "0"}
          description="Succesfully delivered"
          icon={<CheckCircle2 className="h-4 w-4" />}
          trend={{ value: 0, isPositive: true }}
        />
        <DashboardCard
          title="Cancelled Orders"
          value={analytics?.ordersReport?.[4]?.toString() || "0"}
          description="Cancelled by user/admin"
          icon={<AlertCircle className="h-4 w-4" />}
          trend={{ value: 0, isPositive: false }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">
              Recent Orders
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <a href="/orders">View All</a>
            </Button>
          </CardHeader>
          <CardContent>
            <Table
              data={recentOrders}
              columns={[
                {
                  header: "Order ID",
                  accessorKey: "orderNo",
                  className: "font-medium",
                },
                {
                  header: "Customer",
                  accessorKey: (row: any) => `${row.user?.firstName || ''} ${row.user?.lastName || ''}`,
                },
                {
                  header: "Total",
                  accessorKey: (row: any) => formatPrice(row.total),
                },
                {
                  header: "Status",
                  accessorKey: (row: any) => {
                    const statusColor: Record<string, string> = {
                      delivered: "text-green-500 bg-green-50 border-green-200",
                      processing: "text-blue-500 bg-blue-50 border-blue-200",
                      ontheway: "text-blue-500 bg-blue-50 border-blue-200",
                      shipped: "text-yellow-500 bg-yellow-50 border-yellow-200",
                      pending: "text-yellow-500 bg-yellow-50 border-yellow-200",
                      cancelled: "text-red-500 bg-red-50 border-red-200",
                      returned: "text-gray-500 bg-gray-50 border-gray-200",
                    };
                    const status = row.status?.toLowerCase() || 'pending';
                    return (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor[status] || statusColor.pending}`}
                      >
                        {status}
                      </span>
                    );
                  },
                  className: "text-right",
                },
              ]}
              onRowClick={(row) => window.location.href = `/orders/${row._id}`}
            />
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">
              Top Selling Products
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <a href="/products">View All</a>
            </Button>
          </CardHeader>
          <CardContent>
            <Table
              data={topSellingProducts}
              columns={[
                {
                  header: "Product",
                  accessorKey: "name",
                  className: "font-medium",
                },
                {
                  header: "Sold",
                  accessorKey: "sold",
                  className: "text-right",
                },
                {
                  header: "Revenue",
                  accessorKey: "revenue",
                  className: "text-right",
                },
              ]}
              onRowClick={(row) => window.location.href = `/products/${row.id}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
