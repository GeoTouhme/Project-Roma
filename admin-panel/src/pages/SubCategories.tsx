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
import { subCategoriesAPI } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

interface SubCategory {
  _id: string;
  name: string;
  slug: string;
  parentCategory: {
    _id: string;
    name: string;
  };
  status: "Active" | "Inactive";
  createdAt: string;
}

const SubCategories = () => {
  const navigate = useNavigate();

  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSubCategories = async () => {
    try {
      setIsLoading(true);
      const response = await subCategoriesAPI.getSubCategories({
        page: currentPage,
        limit: pageSize,
        search: searchQuery,
      });
      if (response.data.success) {
        setSubCategories(response.data.data);
        setTotalCount(response.data.count);
      }
    } catch (error) {
      toast.error("Failed to fetch sub-categories");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubCategories();
  }, [currentPage, pageSize, searchQuery]);

  // Filtered Data (Client side status filter)
  const filteredSubCategories = subCategories.filter((subCategory) => {
    const matchesStatus =
      statusFilter === "all" ||
      (subCategory.status && subCategory.status.toLowerCase() === statusFilter.toLowerCase());

    return matchesStatus;
  });

  // Handle Row Click
  const handleRowClick = (subCategory: SubCategory) => {
    navigate(`/sub-categories/${subCategory.slug}`);
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Sub Categories"
        description="Manage the list of sub categories."
        actions={
          <Button onClick={() => navigate("/sub-categories/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Sub Category
          </Button>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <SearchBar
          onSearch={(query) => {
            setSearchQuery(query);
            setCurrentPage(1);
          }}
          placeholder="Search sub categories..."
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

      {/* Subcategories Table */}
      <Table
        data={filteredSubCategories}
        isLoading={isLoading}
        columns={[
          { header: "Name", accessorKey: "name" },
          {
            header: "Parent Category",
            accessorKey: (row) => row.parentCategory?.name || "-"
          },
          {
            header: "Status",
            accessorKey: (row) => {
              const status = row.status || "Active";
              const statusColor =
                status === "Active"
                  ? "text-green-500 bg-green-50 border-green-200"
                  : "text-red-500 bg-red-50 border-red-200";

              return (
                <span className={`px-2 py-1 rounded-md border text-xs font-medium ${statusColor}`}>
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
          totalPages={totalCount}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default SubCategories;
