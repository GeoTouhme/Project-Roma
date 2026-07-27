import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";
// import { toast } from "@/lib/toast"; // Use sonner instead
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoriesAPI } from "@/lib/api";
import { getAdminThumbnail } from "@/lib/utils";

const MainCategoryForm = () => {
  const { id } = useParams<{ id?: string }>(); // id is actually the slug
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("Active");
  const [imageUrl, setImageUrl] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [crvRate, setCrvRate] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCategory();
    }
  }, [id]);

  const fetchCategory = async () => {
    try {
      setIsLoading(true);
      const response = await categoriesAPI.getCategoryBySlug(id!);
      if (response.data.success) {
        const data = response.data.data;
        setName(data.name);
        setStatus(data.status);
        setTaxable(data.taxable !== false);
        setCrvRate(data.crvRate || 0);
        if (data.cover && data.cover.url) {
          setImageUrl(data.cover.url);
        }
      }
    } catch (error) {
      console.error("Failed to fetch category", error);
      toast.error("Failed to fetch category details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("Please enter a category name.");
      return;
    }
    if (!imageUrl) {
      toast.error("Please enter a cover image URL.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        status,
        taxable,
        crvRate,
        cover: {
          url: imageUrl,
          _id: `img-${Date.now()}`, // Temporary ID
          blurDataURL: "", // Backend handles this or allows empty? Model says required.
          // Backend controller: if (!cover.blurDataURL) cover.blurDataURL = await getBlurDataURL(cover.url);
          // So we can send it empty or let backend handle it?
          // Model says required. Let's send a placeholder or let backend generate.
          // Controller line 104: if (!cover.blurDataURL) ...
          // So we don't strictly need to send it if backend generates it.
          // But wait, if model requires it, mongoose validation runs BEFORE controller logic?
          // No, controller constructs the object then calls create.
          // Actually controller calls Categories.create({...}).
          // If I send it as empty string? createCategory controller:
          // const { cover, ...others } = req.body;
          // const blurDataURL = await getBlurDataURL(cover.url);
          // ... cover: { ...cover, blurDataURL }
          // So backend OVERWRITES/SETS it.
        },
        metaTitle: name, // Required by model
        description: name, // Required by model
        metaDescription: name, // Required by model
        slug: id ? undefined : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      };

      if (id) {
        await categoriesAPI.updateCategory(id, payload);
        toast.success("Category updated successfully!");
      } else {
        await categoriesAPI.createCategory(payload);
        toast.success("Category created successfully!");
      }
      navigate("/categories");
    } catch (error: any) {
      console.error("Save failed", error);
      toast.error(error.response?.data?.message || "Failed to save category");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => navigate("/categories")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Categories
        </Button>

        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Category
        </Button>
      </div>

      <PageHeader
        title={id ? "Edit Category" : "Add Category"}
        description={id ? "Update category details." : "Create a new category."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Category Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Enter category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="space-y-2">
            <span className="text-sm font-medium">Cover Image URL</span>
            <Input
              placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            {imageUrl && (
              <div className="mt-2 relative w-full h-40 bg-gray-100 rounded-md overflow-hidden">
                <img src={getAdminThumbnail(imageUrl)} alt="Preview" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <input
              id="taxable"
              type="checkbox"
              checked={taxable}
              onChange={(e) => setTaxable(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="taxable" className="text-sm font-medium">Taxable</label>
          </div>

          <Select value={crvRate.toString()} onValueChange={(v) => setCrvRate(parseFloat(v))}>
            <SelectTrigger>
              <SelectValue placeholder="CRV Rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No CRV</SelectItem>
              <SelectItem value="0.05">$0.05 (under 24 oz)</SelectItem>
              <SelectItem value="0.10">$0.10 (24 oz or larger)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
};

export default MainCategoryForm;
