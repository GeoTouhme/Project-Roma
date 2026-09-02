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
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Upload, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoriesAPI, subCategoriesAPI, uploadAPI } from "@/lib/api";
import { getAdminThumbnail } from "@/lib/utils";

interface Category {
  _id: string;
  name: string;
  slug: string;
}

const SubCategoryForm = () => {
  const { id } = useParams<{ id?: string }>(); // id is slug
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [status, setStatus] = useState("Active");
  const [imageUrl, setImageUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mainCategories, setMainCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchMainCategories();
    if (id) {
      fetchSubCategory();
    }
  }, [id]);

  const fetchMainCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories({ limit: 500 });
      if (response.data.success) {
        setMainCategories(response.data.data);
      }
    } catch (error) {
      console.error("Failed to load categories", error);
      toast.error("Failed to load parent categories");
    }
  };

  const fetchSubCategory = async () => {
    try {
      setIsLoading(true);
      const response = await subCategoriesAPI.getSubCategoryBySlug(id!);
      if (response.data.success) {
        const data = response.data.data;
        setName(data.name);
        setStatus(data.status);
        if (data.parentCategory) {
          setParentId(typeof data.parentCategory === 'object' ? data.parentCategory._id : data.parentCategory);
        }
        if (data.cover && data.cover.url) {
          setImageUrl(data.cover.url);
        }
      }
    } catch (error) {
      console.error("Failed to fetch subcategory", error);
      toast.error("Failed to load subcategory details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await uploadAPI.uploadImage(formData);
      if (response.data?.success && response.data.data?.url) {
        setImageUrl(response.data.data.url);
        toast.success("Cover image uploaded");
      } else {
        throw new Error("Upload response did not contain a URL");
      }
    } catch (error: any) {
      console.error("Cover upload failed", error);
      toast.error(error.message || "Failed to upload cover image");
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!name || !parentId) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!imageUrl) {
      toast.error("Please upload a cover image.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        status,
        parentCategory: parentId,
        cover: {
          url: imageUrl,
          _id: `img-${Date.now()}`,
          blurDataURL: "",
        },
        metaTitle: name,
        description: name,
        metaDescription: name,
        slug: id ? undefined : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      };

      if (id) {
        await subCategoriesAPI.updateSubCategory(id, payload);
        toast.success("Subcategory updated successfully!");
      } else {
        await subCategoriesAPI.createSubCategory(payload);
        toast.success("Subcategory created successfully!");
      }
      navigate("/sub-categories");
    } catch (error: any) {
      console.error("Save failed", error);
      toast.error(error.response?.data?.message || "Failed to save subcategory");
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
          onClick={() => navigate("/sub-categories")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sub Categories
        </Button>

        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Sub Category
        </Button>
      </div>

      <PageHeader title={id ? "Edit Sub Category" : "Add Sub Category"} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Sub Category Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Enter sub category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select parent category" />
            </SelectTrigger>
            <SelectContent>
              {mainCategories.map((cat) => (
                <SelectItem key={cat._id} value={cat._id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-2">
            <span className="text-sm font-medium">Cover Image</span>
            <div className="flex items-center gap-3">
              <label className="relative cursor-pointer">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  disabled={coverUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Button type="button" variant="outline" size="sm" disabled={coverUploading}>
                  {coverUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {coverUploading ? "Uploading..." : "Upload Cover"}
                </Button>
              </label>
              {imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setImageUrl("")}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default SubCategoryForm;
