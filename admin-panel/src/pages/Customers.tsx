import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Table } from "@/components/Table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { customersAPI } from "@/lib/api";
import { format } from "date-fns";
import PageSizeSelector from "@/components/PageSizeSelector";
import Pagination from "@/components/Pagination";

const Customers = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Data state
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const response = await customersAPI.getCustomers({
          page: currentPage,
          limit: pageSize,
          search: searchQuery,
        });

        if (response.data.success) {
          setCustomers(response.data.data);
          // Backend returns 'count' which is total pages, but we need total items for my Pagination component? 
          // Wait, backend returns: count: Math.ceil(totalUserCounts / limit)
          // My Pagination component likely takes totalPages.
          // Let's use count as totalPages.
          setTotalCustomers(response.data.count);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchCustomers();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchQuery]);


  const handleAddCustomer = () => {
    navigate("/customers/new");
  };

  const handleRowClick = (customer: any) => {
    navigate(`/customers/${customer._id}`);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <PageHeader
        title="Customers"
        description="View and manage your customer list."
        actions={
          <Button onClick={handleAddCustomer}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        {/* Search Bar */}
        <SearchBar
          onSearch={setSearchQuery}
          placeholder="Search customers..."
          className="w-full md:max-w-sm"
        />

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Table */}
      <Table
        data={customers}
        isLoading={loading}
        columns={[
          {
            header: "Customer",
            accessorKey: (row) => (
              <div>
                <div className="font-medium">{row.firstName} {row.lastName}</div>
                <div className="text-xs text-muted-foreground">{row.email}</div>
              </div>
            ),
          },
          {
            header: "Role",
            accessorKey: "role",
            className: "capitalize",
          },
          {
            header: "Status",
            accessorKey: (row) => {
              // Logic for status based on isVerified
              const status = row.isVerified ? "Active" : "Inactive";
              const statusColor =
                status === "Active"
                  ? "text-green-500 bg-green-50 border-green-200"
                  : "text-red-500 bg-red-50 border-red-200";

              return (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                >
                  {status}
                </span>
              );
            },
            className: "text-center",
          },
          {
            header: "Created At",
            accessorKey: (row) => row.createdAt ? format(new Date(row.createdAt), "MMM d, yyyy") : "-",
            className: "text-right",
          },
        ]}
        onRowClick={handleRowClick}
      />

      {/* Pagination */}
      <div className="flex justify-between items-center py-4">
        <PageSizeSelector pageSize={pageSize} onPageSizeChange={setPageSize} />
        <Pagination
          currentPage={currentPage}
          totalPages={totalCustomers} // backend 'count' is total pages
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default Customers;
