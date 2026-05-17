import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { analyticsAPI } from "@/lib/api";
import { Eye, TrendingUp, Users, MousePointer } from "lucide-react";

const COLORS = ["#B5223B", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#db2777"];

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await analyticsAPI.getAnalytics();
        if (res.data.success) {
          setData(res.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-7xl">
        <PageHeader title="Analytics" description="Visitor and product view insights" />
        <div className="mt-6">Loading analytics...</div>
      </div>
    );
  }

  const counts = data?.counts || {};
  const topToday = data?.topProducts?.today || [];
  const top7 = data?.topProducts?.last7Days || [];
  const pagesToday = data?.topPages?.today || [];
  const pages7 = data?.topPages?.last7Days || [];
  const sources = (data?.sources || []).map((s: any) => ({
    name: s._id ? s._id.charAt(0).toUpperCase() + s._id.slice(1) : "Unknown",
    value: s.views,
  }));
  const dailyViews = data?.dailyViews || [];

  return (
    <div className="w-full max-w-7xl">
      <PageHeader title="Analytics" description="Visitor and product view insights" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard label="Today's Views" value={counts.today || 0} icon={<Eye className="w-5 h-5 text-primary" />} />
        <StatCard label="Yesterday's Views" value={counts.yesterday || 0} icon={<TrendingUp className="w-5 h-5 text-primary" />} />
        <StatCard label="Last 7 Days" value={counts.last7Days || 0} icon={<Users className="w-5 h-5 text-primary" />} />
        <StatCard label="Last 30 Days" value={counts.last30Days || 0} icon={<MousePointer className="w-5 h-5 text-primary" />} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Daily Views Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Views (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyViews}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="views" fill="#B5223B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sources Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Traffic Sources (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {sources.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sources}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {sources.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                No source data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <TopProductsCard title="Top Products Today" products={topToday} />
        <TopProductsCard title="Top Products (Last 7 Days)" products={top7} />
      </div>

      {/* Top Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <TopProductsCard title="Top Pages Today" products={pagesToday} />
        <TopProductsCard title="Top Pages (Last 7 Days)" products={pages7} />
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <Card>
    <CardContent className="p-5 flex items-center justify-between">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
      </div>
      <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
    </CardContent>
  </Card>
);

const TopProductsCard = ({ title, products }: { title: string; products: any[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {products.length === 0 ? (
        <div className="text-sm text-muted-foreground">No views recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {products.map((p: any, i: number) => (
            <div key={p._id || i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                  {i + 1}
                </div>
                <div className="text-sm truncate max-w-[200px]" title={p.name || p._id}>
                  {p.name || p._id}
                </div>
              </div>
              <div className="text-sm font-semibold">{p.views} views</div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default Analytics;
