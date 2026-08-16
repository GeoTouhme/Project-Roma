import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ImagePlus, Save, Trash, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { categoriesAPI, subCategoriesAPI, productsAPI, uploadAPI } from "@/lib/api";

const ProductForm = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();

    // Form State
    const [name, setName] = useState("");
    const [mainCategoryId, setMainCategoryId] = useState("");
    const [subCategory, setSubCategory] = useState(""); // This is the ID of the subcategory
    const [price, setPrice] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [stock, setStock] = useState("");
    const [sku, setSku] = useState("");
    const [size, setSize] = useState("");
    const [status, setStatus] = useState("active");
    const [description, setDescription] = useState("");
    const [featured, setFeatured] = useState(false);
    const [isBestSeller, setIsBestSeller] = useState(false);
    const [isTopCollection, setIsTopCollection] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [saleEndsAt, setSaleEndsAt] = useState<string>("");

    // Data State
    const [categories, setCategories] = useState<any[]>([]);
    const [subCategories, setSubCategories] = useState<any[]>([]);
    const [isSubLoading, setIsSubLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch Main Categories on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await categoriesAPI.getCategories({ limit: 500 });
                if (response.data.success) {
                    setCategories(response.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch categories", error);
                toast.error("Failed to load categories");
            }
        };
        fetchCategories();
    }, []);

    // Fetch Sub Categories when Main Category changes
    useEffect(() => {
        if (mainCategoryId) {
            const fetchSubCategories = async () => {
                setIsSubLoading(true);
                try {
                    const response = await subCategoriesAPI.getSubCategories({
                        limit: 500,
                        parentCategory: mainCategoryId
                    });
                    if (response.data.success) {
                        setSubCategories(response.data.data);
                    }
                } catch (error) {
                    console.error("Failed to fetch subcategories", error);
                    toast.error("Failed to load subcategories");
                } finally {
                    setIsSubLoading(false);
                }
            };
            fetchSubCategories();
        } else {
            setSubCategories([]);
        }
    }, [mainCategoryId]);

    // Load product details if editing
    useEffect(() => {
        if (id) {
            const fetchProduct = async () => {
                try {
                    const response = await productsAPI.getProductById(id);
                    if (response.data.success) {
                        const product = response.data.data;
                        setName(product.name);
                        setSku(product.sku || product.code || "");
                        setSize(product.size || "");
                        setPrice(product.price?.toString() || "");
                        setSalePrice(product.priceSale?.toString() || "");
                        setStock(product.available?.toString() || "0");
                        setDescription(product.description || "");
                        setFeatured(product.isFeatured || false);
                        setIsBestSeller(product.isBestSeller || false);
                        setIsTopCollection(product.isTopCollection || false);
                        setStatus(product.status || "active");
                        setSaleEndsAt(product.saleEndsAt ? new Date(product.saleEndsAt).toISOString().slice(0, 16) + "Z" : "");

                        // Handle images
                        if (product.images && Array.isArray(product.images)) {
                            setImages(product.images.map((img: any) => typeof img === 'string' ? img : img.url));
                        }

                        // Handle Categories
                        // Assuming category and subCategory are IDs or Objects with _id
                        const catId = product.category && typeof product.category === 'object' ? product.category._id : product.category;
                        const subId = product.subCategory && typeof product.subCategory === 'object' ? product.subCategory._id : product.subCategory;

                        setMainCategoryId(catId || "");
                        // We need to set subCategory after mainCategoryId triggers the subcategory fetch, 
                        // but for now setting it directly might race with the subcat fetch useEffect.
                        // However, the Select component will just wait for options. 
                        // Actually, if we set subCategory immediately, it might be fine as long as the options eventually load.
                        setSubCategory(subId || "");
                    }
                } catch (error) {
                    console.error("Failed to fetch product details", error);
                    toast.error("Failed to load product details");
                }
            };
            fetchProduct();
        }
    }, [id]);

    // Handle Image URL Add
    const handleAddImage = () => {
        if (imageUrlInput) {
            setImages([...images, imageUrlInput]);
            setImageUrlInput("");
        }
    }

    const getPublicIdFromUrl = (url: string) => {
        try {
            if (!url) return null;
            // Example: https://res.cloudinary.com/demo/image/upload/v1614066752/balport-products/sample.jpg
            // We need 'balport-products/sample'
            const parts = url.split('/');
            const versionIndex = parts.findIndex(part => part.startsWith('v'));
            if (versionIndex !== -1) {
                const publicIdWithExtension = parts.slice(versionIndex + 1).join('/');
                const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
                if (lastDotIndex !== -1) {
                    return publicIdWithExtension.substring(0, lastDotIndex);
                }
                return publicIdWithExtension;
            }
            return null;
        } catch (error) {
            console.error("Error parsing image URL", error);
            return null;
        }
    };

    const handleRemoveImage = async (index: number) => {
        const imageUrl = images[index];
        const publicId = getPublicIdFromUrl(imageUrl);

        if (publicId) {
            try {
                // Determine if it's a new upload (we might want a different UX or just delete it)
                // For now, if we have a public ID, we try to delete it from server.
                await uploadAPI.deleteImage(publicId);
                toast.success("Image deleted from server");
            } catch (error) {
                console.error("Failed to delete image from server", error);
                toast.error("Failed to delete image from server, but removed locally");
            }
        }

        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await uploadAPI.uploadImage(formData);
            if (response.data.success) {
                setImages([...images, response.data.data.url]);
                toast.success("Image uploaded successfully");
            }
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Failed to upload image");
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    // Handle save product
    const handleSave = async () => {
        if (!name) { toast.error("Product Name is required"); return; }
        if (!sku) { toast.error("SKU is required"); return; }
        if (!mainCategoryId) { toast.error("Main Category is required"); return; }
        if (!subCategory) { toast.error("Sub Category is required"); return; }
        // if (!price) { toast.error("Price is required"); return; }
        if (!stock) { toast.error("Stock is required"); return; }
        if (images.length === 0) { toast.error("At least one image is required"); return; }

        setIsSaving(true);
        try {
            // Formatted images for backend
            const formattedImages = images.map((url, index) => ({
                _id: `img-${Date.now()}-${index}`,
                url: url
            }));

            // Generate slug from name
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

            const payload = {
                name,
                code: sku,
                sku,
                slug,
                description,
                price: price ? parseFloat(price) : 0,
                priceSale: salePrice ? parseFloat(salePrice) : 0,
                available: parseInt(stock),
                size: size || null,
                category: mainCategoryId,
                subCategory: subCategory,
                images: formattedImages,
                isFeatured: featured,
                isBestSeller,
                isTopCollection,
                status: status,
                saleEndsAt: saleEndsAt ? new Date(saleEndsAt).toISOString() : null,
            };

            if (id) {
                await productsAPI.updateProduct(id, payload);
                toast.success("Product updated successfully!");
            } else {
                await productsAPI.createProduct(payload);
                toast.success("Product created successfully!");
            }
            navigate("/products");
        } catch (error: any) {
            console.error("Save failed", error);
            toast.error(error.response?.data?.message || "Failed to save product");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 w-full">
            {/* Back and Save */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate("/products")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Products
                </Button>

                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Product"}
                </Button>
            </div>

            <PageHeader
                title={id ? "Edit Product" : "Add Product"}
                description={id ? "Update product details." : "Add a new product"}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Product Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Product Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <Input
                        placeholder="SKU (Stock Keeping Unit)"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                    />

                    <Input
                        placeholder="Size (e.g. 750ml, 12oz, 1.75L)"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            value={mainCategoryId}
                            onValueChange={(value) => {
                                setMainCategoryId(value);
                                setSubCategory("");
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Main Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat._id} value={cat._id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={subCategory} onValueChange={setSubCategory} disabled={!mainCategoryId || isSubLoading}>
                            <SelectTrigger>
                                <SelectValue placeholder={isSubLoading ? "Loading..." : "Select Sub Category"} />
                            </SelectTrigger>
                            <SelectContent>
                                {subCategories.map((sub) => (
                                    <SelectItem key={sub._id} value={sub._id}>
                                        {sub.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            placeholder="Price"
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                        <Input
                            placeholder="Sale Price"
                            type="number"
                            value={salePrice}
                            onChange={(e) => setSalePrice(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <label className="text-sm font-medium text-gray-700">Flash Sale Ends (UTC)</label>
                        <Input
                            type="datetime-local"
                            value={saleEndsAt.replace('Z', '')}
                            onChange={(e) => {
                                const localValue = e.target.value;
                                setSaleEndsAt(localValue ? `${localValue}Z` : '');
                            }}
                        />
                        <p className="text-xs text-gray-500">Time is stored and displayed in UTC.</p>
                    </div>

                    <Input
                        placeholder="Stock Quantity"
                        type="number"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                    />

                    <Textarea
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <Checkbox
                        label="Featured Product"
                        checked={featured}
                        onCheckedChange={(state: boolean) => setFeatured(state)}
                    />

                    <Checkbox
                        label="Best Seller"
                        checked={isBestSeller}
                        onCheckedChange={(state: boolean) => setIsBestSeller(state)}
                    />

                    <Checkbox
                        label="Top Collection"
                        checked={isTopCollection}
                        onCheckedChange={(state: boolean) => setIsTopCollection(state)}
                    />

                    <div className="flex gap-2">
                        <Input
                            placeholder="Image URL (e.g. from Cloudinary)"
                            value={imageUrlInput}
                            onChange={(e) => setImageUrlInput(e.target.value)}
                        />
                        <Button onClick={handleAddImage} type="button" variant="outline">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>


                    <div className="flex items-center gap-2">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <label htmlFor="picture" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Upload Image
                            </label>
                            <Input id="picture" type="file" onChange={handleFileUpload} disabled={isUploading} accept="image/*" />
                        </div>
                        {isUploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Backend requires hosted image URLs. You can upload an image above or enter a direct link below.
                    </p>

                    <div className="flex items-center gap-4 flex-wrap">
                        {images.map((src, index) => (
                            <div key={index} className="relative group">
                                <img
                                    src={src}
                                    alt={`Product Image ${index + 1}`}
                                    crossOrigin="anonymous"
                                    className="w-24 h-24 object-cover rounded border bg-gray-100"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const fallback = e.target.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                                <div className="hidden w-24 h-24 rounded border bg-gray-100 items-center justify-center text-xs text-muted-foreground">
                                    Error
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage(index)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div >
    );
};

export default ProductForm;
