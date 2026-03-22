import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Table } from "@/components/Table";
import { SearchBar } from "@/components/SearchBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import PageSizeSelector from "@/components/PageSizeSelector";
import Pagination from "@/components/Pagination";
import { ordersAPI } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Orders = () => {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // const [statusFilter, setStatusFilter] = useState("all"); // Backend doesn't support status filter yet
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await ordersAPI.getOrders({
        page: currentPage,
        limit: pageSize,
        search: searchQuery,
      });

      if (response.data.success) {
        setOrders(response.data.data);
        setTotalOrders(response.data.total);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchOrders();
    }, 500); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchQuery]);

  const handleRowClick = (order: any) => {
    navigate(`/orders/${order._id}`);
  };

  const totalPages = Math.ceil(totalOrders / pageSize);

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Orders"
        description="View and manage all customer orders."
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <SearchBar
          onSearch={setSearchQuery}
          placeholder="Search by customer name..."
          className="w-full sm:max-w-sm"
        />

        {/* Status Filter - Commented out until backend support
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        */}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Table
          data={orders}
          columns={[
            {
              header: "Order ID",
              accessorKey: (item: any) => <span className="font-mono text-xs">{item.orderNo || item._id.substring(0, 8)}</span>
            },
            {
              header: "Customer",
              accessorKey: (item: any) => (
                <div className="flex flex-col">
                  <span className="font-medium">{item.user?.firstName} {item.user?.lastName}</span>
                  <span className="text-xs text-muted-foreground">{item.user?.email}</span>
                </div>
              )
            },
            {
              header: "Date",
              accessorKey: (item: any) => new Date(item.createdAt).toLocaleDateString()
            },
            {
              header: "Items",
              accessorKey: "totalItems"
            },
            {
              header: "Total",
              accessorKey: (item: any) => `$${item.total?.toFixed(2)}`
            },
            {
              header: "Status",
              accessorKey: (item: any) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                  ${item.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    item.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      item.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'}`}>
                  {item.status}
                </span>
              )
            },
          ]}
          onRowClick={handleRowClick}
        />
      )}

      {/* Pagination & Page Size */}
      <div className="flex items-center justify-between mt-4">
        <PageSizeSelector pageSize={pageSize} onPageSizeChange={setPageSize} />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages || 1}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default Orders;
