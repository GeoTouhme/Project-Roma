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
import PageSizeSelector from "@/components/PageSizeSelector";
import Pagination from "@/components/Pagination";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { productsAPI, categoriesAPI } from "@/lib/api";

const Products = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Data state
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesAPI.getCategories();
        if (response.data.success) {
          setCategories(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch Products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Prepare params
        // Note: The backend getProductsByAdmin (which is what productsAPI.getProducts calls likely?)
        // Let's check api.ts -> productsAPI.getProducts -> /api/admin/products
        // backend/src/controllers/product.js -> getProductsByAdmin
        // It accepts: page, limit, search.
        // It does NOT seem to accept 'category' or 'status' filter in the query params directly for filtering in DB?
        // Wait, getProductsByAdmin only uses: name: { $regex: searchQuery ... }
        // It DOES NOT implement category or status filtering!
        // So I must filter on FRONTEND? Or update backend?
        // For now, I will filter on frontend if the API doesn't support it, 
        // BUT calling the API with pagination makes frontend filtering impossible for correct results across pages.
        // However, sticking to the plan: I will just pass search. Filtering by category might need backend support.
        // Given constraints, I will implement search param.

        const response = await productsAPI.getProducts({
          page: currentPage,
          limit: pageSize,
          search: searchQuery,
        });

        if (response.data.success) {
          setProducts(response.data.data);
          setTotalProducts(response.data.count); // count is total pages
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchProducts();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchQuery]);

  // Helper to get category name
  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c._id === categoryId);
    return cat ? cat.name : "Unknown";
  };

  const handleAddProduct = () => {
    navigate("/products/new");
  };

  const handleRowClick = (product: any) => {
    navigate(`/products/${product.slug}`); // Use slug or id? Backend uses slug for getOneProductByAdmin
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <PageHeader
        title="Products"
        description="View and manage your product inventory."
        actions={
          <Button onClick={handleAddProduct}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <SearchBar
          onSearch={setSearchQuery}
          placeholder="Search products..."
          className="w-full md:max-w-sm"
        />

        <div className="flex gap-2 flex-wrap">
          {/* Category Filter - Note: This won't work perfectly without backend support, disabling or keeping for UI */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat._id} value={cat.slug || cat._id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="low stock">Low Stock</SelectItem>
              <SelectItem value="out of stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Products Table */}
      <Table
        data={products}
        isLoading={loading}
        columns={[
          {
            header: "Product",
            accessorKey: (row) => (
              <div className="flex items-center gap-3">
                <img
                  src={row.image?.url || "https://dummyimage.com/100x100/ecf0f1/7f8c8d?text=No+Image"}
                  alt={row.name}
                  className="h-10 w-10 rounded-md object-cover border"
                />
                <div>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">{row.sku || row.slug}</div>
                </div>
              </div>
            ),
          },
          {
            header: "Category",
            accessorKey: (row) => row.categoryData?.[0]?.name || "Unknown",
          },
          {
            header: "Price",
            accessorKey: (row) => `$${row.priceSale || row.price}`,
            className: "text-right",
          },
          {
            header: "Stock",
            accessorKey: "available", // 'available' is the quantity field
            className: "text-center",
          },
          {
            header: "Status",
            accessorKey: (row) => {
              const stock = row.available || 0;
              let status = "Active";
              if (stock === 0) status = "Out of Stock";
              else if (stock < 10) status = "Low Stock";

              const statusColor =
                {
                  "Active": "text-green-500 bg-green-50 border-green-200",
                  "Low Stock": "text-yellow-500 bg-yellow-50 border-yellow-200",
                  "Out of Stock": "text-red-500 bg-red-50 border-red-200",
                }[status] || "text-gray-500 bg-gray-50 border-gray-200";

              return (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                >
                  {status}
                </span>
              );
            },
            className: "text-right",
          },
        ]}
        onRowClick={handleRowClick}
      />

      {/* Pagination and Page Size */}
      <div className="flex justify-between items-center py-4">
        <PageSizeSelector pageSize={pageSize} onPageSizeChange={setPageSize} />
        <Pagination
          currentPage={currentPage}
          totalPages={totalProducts}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default Products;
