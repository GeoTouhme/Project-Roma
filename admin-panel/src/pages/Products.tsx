import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageSizeSelector from "@/components/PageSizeSelector";
import Pagination from "@/components/Pagination";
import { Plus, Download, Upload, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { productsAPI, categoriesAPI } from "@/lib/api";
import { getAdminThumbnail } from "@/lib/utils";

const Products = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  // Data state
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesAPI.getCategories({ limit: 100 });
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
        const response = await productsAPI.getProducts({
          page: currentPage,
          limit: pageSize,
          search: searchQuery,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
        });

        if (response.data.success) {
          let result = response.data.data;

          // Frontend status filter (backend doesn't support it)
          if (statusFilter !== 'all') {
            result = result.filter((p: any) => {
              const stock = p.available || 0;
              if (statusFilter === 'out of stock') return stock === 0;
              if (statusFilter === 'low stock') return stock > 0 && stock < 10;
              if (statusFilter === 'active') return stock >= 10;
              return true;
            });
          }

          setProducts(result);
          setTotalProducts(response.data.count);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchProducts();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchQuery, categoryFilter, statusFilter]);

  // Helper to get category name
  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c._id === categoryId);
    return cat ? cat.name : "Unknown";
  };

  const handleAddProduct = () => {
    navigate("/products/new");
  };

  const handleRowClick = (product: any) => {
    navigate(`/products/${product.slug}`);
  };

  const handleCategoryChange = async (productSlug: string, newCategoryId: string) => {
    try {
      await productsAPI.updateProduct(productSlug, { category: newCategoryId });
      setEditingCategoryId(null);
      toast.success("Category updated");
      // Refresh products
      const response = await productsAPI.getProducts({
        page: currentPage,
        limit: pageSize,
        search: searchQuery,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      if (response.data.success) {
        let result = response.data.data;
        if (statusFilter !== 'all') {
          result = result.filter((p: any) => {
            const stock = p.available || 0;
            if (statusFilter === 'out of stock') return stock === 0;
            if (statusFilter === 'low stock') return stock > 0 && stock < 10;
            if (statusFilter === 'active') return stock >= 10;
            return true;
          });
        }
        setProducts(result);
      }
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error("Failed to update category");
    }
  };

  // ─── CSV Download Handler ───
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const response = await productsAPI.exportCSV();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `inventory_${date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Inventory CSV downloaded successfully");
    } catch (error) {
      console.error("Failed to export CSV:", error);
      toast.error("Failed to download inventory CSV");
    } finally {
      setIsExporting(false);
    }
  };

  // ─── CSV Upload Handler ───
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const response = await productsAPI.importCSV(file);
      if (response.data.success) {
        const { created, updated, errors } = response.data.data;
        setImportResult({ created, updated, errors });
        setImportResultOpen(true);
        // Refresh product list
        setCurrentPage(1);
      } else {
        toast.error(response.data.message || "Import failed");
      }
    } catch (error: any) {
      console.error("Failed to import CSV:", error);
      const errorMsg = error.response?.data?.message || "Failed to import CSV";
      setImportResult({ created: 0, updated: 0, errors: [errorMsg] });
      setImportResultOpen(true);
    } finally {
      setIsImporting(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Hidden file input for CSV upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        onChange={handleImportCSV}
        className="hidden"
        id="csv-upload-input"
      />

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

      {/* CSV Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Download Inventory CSV"}
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isImporting ? "Importing..." : "Upload Inventory CSV"}
        </Button>
      </div>

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
                  src={getAdminThumbnail(row.image?.url) || "https://dummyimage.com/100x100/ecf0f1/7f8c8d?text=No+Image"}
                  alt={row.name}
                  className="h-10 w-10 rounded-md object-cover border"
                  loading="lazy"
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
            accessorKey: (row) => {
              if (editingCategoryId === row.slug) {
                return (
                  <Select value={row.categoryData?._id || row.category || ""} onValueChange={(val) => handleCategoryChange(row.slug, val)}>
                    <SelectTrigger className="h-6 w-[140px]">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }
              return (
                <div
                  onClick={(e) => { e.stopPropagation(); setEditingCategoryId(row.slug); }}
                  className="cursor-pointer hover:bg-accent px-2 py-1 rounded inline-block"
                >
                  {row.categoryData?.name || "Unknown"}
                </div>
              );
            },
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

      {/* Import Results Dialog */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg">CSV Import Results</DialogTitle>
            <DialogDescription>Summary of the inventory import operation.</DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-xl font-bold text-green-700">{importResult.created}</div>
                    <div className="text-xs text-green-600">Created</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-xl font-bold text-blue-700">{importResult.updated}</div>
                    <div className="text-xs text-blue-600">Updated</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="text-xl font-bold text-red-700">{importResult.errors.length}</div>
                    <div className="text-xs text-red-600">Errors</div>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Error Details
                  </div>
                  <div className="max-h-[250px] overflow-y-auto rounded-md border border-red-200 bg-red-50/50 p-3 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="text-sm text-red-700 py-1 border-b border-red-100 last:border-0">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success message when no errors */}
              {importResult.errors.length === 0 && (importResult.created > 0 || importResult.updated > 0) && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  All rows imported successfully!
                </div>
              )}

              <Button onClick={() => setImportResultOpen(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;

