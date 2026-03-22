
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  data?: Array<{ name: string; value: number }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  description,
  data,
  trend,
  color = "hsl(var(--primary))",
}) => {
  const chartData = data || generateDummyData();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold">{value}</h2>
            {trend && (
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {trend.isPositive ? "+" : "-"}
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="h-[100px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                hide 
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  border: 'none'
                }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function to generate dummy data
const generateDummyData = () => {
  return Array.from({ length: 12 }, (_, i) => ({
    name: `Day ${i + 1}`,
    value: Math.floor(Math.random() * 100) + 20,
  }));
};

export default StatsCard;
