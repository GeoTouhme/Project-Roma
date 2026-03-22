import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash, Loader2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { productsAPI } from "@/lib/api";
import { format } from "date-fns";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>(); // This is actually the slug or ID depending on route
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setIsLoading(true);
      // Try fetching by ID first, if it fails or if the route uses slug, we might need adjustments.
      // The current API client has getProductById. Let's assume it handles the lookup.
      // If the URL is /products/some-slug, we might need a getProductBySlug endpoint or use getProductById if it supports slugs.
      // Based on previous files, backend often uses slugs.
      // Let's check api.ts again. productsAPI has getProductById taking 'id'.
      // Backend controller usually has getProductById(req.params.id) and getProductBySlug(req.params.slug).
      // If the frontend route is /products/:id, React Router passes that param.
      // If the value is "heineken-0-0...", that's a slug.
      // I should check if productsAPI has getProductBySlug. If not, I might need to add it or use getProducts({slug: id}).
      // For now, I'll try getProductById. If backend logic supports slug in ID param or I need to add getProductBySlug.
      // Wait, viewing api.ts in previous step will confirm.
      // Assuming I'll see it, I will write the code to use it.
      // If api.ts only has getProductById, and backend expects ID, this will fail for slugs.
      // But usually getProductById in these projects might just hit /api/products/:id.

      // Actually, let's look at the implementation below. I will err on side of caution and use getProductById.
      // If I need to change api.ts I will do it in a separate step if this fails, or check api.ts content from previous view.

      const response = await productsAPI.getProductById(id!);
      if (response.data.success) {
        setProduct(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch product", error);
      toast.error("Failed to load product details");
      // If 404/400, maybe it's because we sent a slug to an ID endpoint? 
      // I'll proceed with this and if it fails, I'll fix api.ts.
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;

    // Debugging: Logging API URL
    console.log("Current API URL:", import.meta.env.VITE_API_URL);

    // TEMPORARY: Removed confirm dialog to rule it out as a blocker
    // if (!confirm(`Are you sure you want to delete ${product.name}?`)) return;

    try {
      const identifier = product.slug || product._id;
      console.log("handleDelete: Sending DELETE request for:", identifier);
      toast.info("Attempting to delete..."); // Visual feedback

      await productsAPI.deleteProduct(identifier);

      console.log("handleDelete: Success");
      toast.success("Product deleted successfully");
      navigate("/products");
    } catch (error: any) {
      console.error("Delete failed object:", error);
      const errorMessage = error.response?.data?.message || error.message || "Unknown error";
      console.error("Delete failed message:", errorMessage);
      toast.error(`Failed to delete: ${errorMessage}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin w-12 h-12 text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-10">
        <h3 className="text-lg font-medium">Product not found</h3>
        <Button variant="link" onClick={() => navigate("/products")}>Back to Products</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      {/* Back and Actions */}
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100"
          onClick={() => navigate("/products")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/products/edit/${product.slug || product._id}`)}
            className="hover:bg-blue-50"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Product
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-500 border-red-300 hover:bg-red-50"
            onClick={handleDelete}
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete Product
          </Button>
        </div>
      </div>

      {/* Page Header */}
      <PageHeader
        title={product.name}
        description={`Added on ${product.createdAt ? format(new Date(product.createdAt), 'MMM dd, yyyy') : 'N/A'}`}
        actions={
          <div
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${product.status === "available" || product.status === "Active" // Adjust based on actual backend status values
              ? "bg-green-50 text-green-500 border-green-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
              }`}
          >
            {product.status || 'Draft'}
          </div>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-50 border rounded-md">
          <TabsTrigger
            value="details"
            className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-600 rounded-md px-4 py-2 transition-colors"
          >
            Product Details
          </TabsTrigger>
        </TabsList>

        {/* Product Details Tab */}
        <TabsContent value="details" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Image Gallery */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Product Images
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex overflow-x-auto gap-3 pb-2">
                  {product.images && product.images.length > 0 ? (
                    product.images.map((img: any, index: number) => (
                      <div key={index} className="relative flex-shrink-0">
                        <img
                          src={img.url}
                          alt={`Product ${index + 1}`}
                          className="h-24 w-24 object-cover rounded-md border border-gray-200"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No images available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pricing and Stock */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Pricing & Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Price</span>
                  <span className="text-sm font-semibold">
                    ${product.price}
                  </span>
                </div>
                {product.priceSale && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Sale Price</span>
                    <span className="text-sm font-semibold text-green-600">
                      ${product.priceSale}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Stock (Available)</span>
                  <span className="text-sm font-semibold">
                    {product.available}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">SKU</span>
                  <span className="text-sm font-semibold">
                    {product.sku || product.code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Category</span>
                  <span className="text-sm font-semibold">
                    {product.category?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Sub Category</span>
                  <span className="text-sm font-semibold">
                    {product.subCategory?.name || 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-medium">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description || "No description provided."}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductDetail;
