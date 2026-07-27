import React, { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageSizeSelector from "@/components/PageSizeSelector";
import Pagination from "@/components/Pagination";
import { categoriesAPI } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

export interface MainCategory {
  _id: string;
  name: string;
  slug: string;
  status: "Active" | "Inactive";
  taxable?: boolean;
  crvRate?: number;
  createdAt: string;
}

const MainCategories = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MainCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const response = await categoriesAPI.getCategories({
        page: currentPage,
        limit: pageSize,
        search: searchQuery,
      });
      if (response.data.success) {
        setCategories(response.data.data);
        // Backend returns count as number of pages usually? 
        // Let's check backend: count: Math.ceil(totalCategories.length / skip)
        // Ah, backend returns 'count' as total PAGES, not total items.
        // But the Pagination component likely expects total PAGES or total ITEMS?
        // Let's check Pagination component later. 
        // For now, assuming count is total pages.
        // Wait, Pagination usually takes totalPages.
        // response.data.count is total pages based on backend logic.
        // But wait, if I want strict total items, backend doesn't output it. 
        // It outputs count = Math.ceil(total / limit). 
        // So I can use that as totalPages directly.
        setTotalCount(response.data.count);
      }
    } catch (error) {
      toast.error("Failed to fetch categories");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [currentPage, pageSize, searchQuery]);

  // Client-side status filter (only filters current page)
  const filteredCategories = categories.filter((category) => {
    const matchesStatus =
      statusFilter === "all" ||
      (category.status && category.status.toLowerCase() === statusFilter.toLowerCase());
    return matchesStatus;
  });

  // Navigate to edit form
  const handleRowClick = (category: MainCategory) => {
    navigate(`/categories/${category.slug}`);
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Main Categories"
        description="Manage the list of product categories."
        actions={
          <Button onClick={() => navigate("/categories/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <SearchBar
          onSearch={(query) => {
            setSearchQuery(query);
            setCurrentPage(1); // Reset to page 1 on search
          }}
          placeholder="Search categories..."
          className="w-full sm:max-w-sm"
        />

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

      {/* Categories Table */}
      <Table
        data={filteredCategories}
        isLoading={isLoading}
        columns={[
          { header: "Category Name", accessorKey: "name" },
          {
            header: "Taxable",
            accessorKey: (row) => (row.taxable === false ? "No" : "Yes"),
          },
          {
            header: "CRV",
            accessorKey: (row) =>
              row.crvRate === 0.05 ? "$0.05" : row.crvRate === 0.1 ? "$0.10" : "-",
          },
          {
            header: "Status",
            accessorKey: (row) => {
              const status = row.status || "Active"; // Default if missing
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
          },
          {
            header: "Created At",
            accessorKey: (row) => row.createdAt ? format(new Date(row.createdAt), "MMM dd, yyyy") : "-",
            className: "text-right",
          },
        ]}
        onRowClick={handleRowClick}
      />

      {/* Pagination & Page Size */}
      <div className="flex justify-between items-center mt-4">
        <PageSizeSelector pageSize={pageSize} onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }} />
        <Pagination
          currentPage={currentPage}
          totalPages={totalCount} // backend returns total pages in 'count'
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default MainCategories;
