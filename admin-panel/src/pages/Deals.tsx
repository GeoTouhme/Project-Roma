import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { dealsAPI, productsAPI } from "@/lib/api";
import { getAdminThumbnail } from "@/lib/utils";
import { Plus, Pencil, Trash2, X } from "lucide-react";

const Deals = () => {
  const [deals, setDeals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    quantity: 2,
    bundlePrice: "",
    productIds: [] as string[],
    startAt: "",
    expiresAt: "",
    status: "active",
    displayOnHome: true,
  });

  const [productSearch, setProductSearch] = useState("");
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  const fetchDeals = async () => {
    try {
      const res = await dealsAPI.getAll();
      if (res.data.success) setDeals(res.data.data);
    } catch (error) {
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (search = "") => {
    try {
      setProductSearchLoading(true);
      const res = await productsAPI.getProducts({ limit: 500, search });
      if (res.data.success) {
        setProducts(
          res.data.data.filter((p: any) =>
            Boolean(p.image?.url && !p.image.url.includes('placeholder'))
          )
        );
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setProductSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
    fetchProducts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(productSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      quantity: 2,
      bundlePrice: "",
      productIds: [],
      startAt: "",
      expiresAt: "",
      status: "active",
      displayOnHome: true,
    });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setForm((prev) => ({
      ...prev,
      startAt: new Date().toISOString().slice(0, 16),
    }));
    setDialogOpen(true);
  };

  const openEdit = (deal: any) => {
    setEditingId(deal._id);
    setForm({
      name: deal.name || "",
      description: deal.description || "",
      quantity: deal.quantity || 2,
      bundlePrice: deal.bundlePrice?.toString() || "",
      productIds: (deal.productIds || []).map((p: any) => p._id || p),
      startAt: deal.startAt ? new Date(deal.startAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      expiresAt: deal.expiresAt ? new Date(deal.expiresAt).toISOString().slice(0, 16) : "",
      status: deal.status || "active",
      displayOnHome: deal.displayOnHome !== false,
    });
    setDialogOpen(true);
  };

  const toggleProduct = (id: string) => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((pid) => pid !== id)
        : [...prev.productIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.productIds.length === 0) {
      toast.error("Select at least one product");
      return;
    }

    const selectedProducts = products.filter((p) => form.productIds.includes(p._id));
    const missingImage = selectedProducts.some(
      (p) => !p.image?.url || p.image.url.includes('placeholder')
    );
    if (missingImage) {
      toast.error("All selected products must have a real image");
      return;
    }

    const payload = {
      ...form,
      quantity: Number(form.quantity),
      bundlePrice: Number(form.bundlePrice),
      startAt: form.startAt ? `${form.startAt}:00Z` : new Date().toISOString(),
      expiresAt: form.expiresAt ? `${form.expiresAt}:00Z` : null,
    };

    try {
      if (editingId) {
        await dealsAPI.update(editingId, payload);
        toast.success("Deal updated");
      } else {
        await dealsAPI.create(payload);
        toast.success("Deal created");
      }
      setDialogOpen(false);
      resetForm();
      fetchDeals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save deal");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this deal?")) return;
    try {
      await dealsAPI.delete(id);
      toast.success("Deal deleted");
      fetchDeals();
    } catch (error) {
      toast.error("Failed to delete deal");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <PageHeader
        title="Bundle Deals"
        description="Create quantity-based deals like Buy 6 for $6"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Deal
          </Button>
        }
      />

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : deals.length === 0 ? (
        <div className="border rounded-lg p-8 text-center bg-card">
          <p className="text-muted-foreground mb-4">No deals created yet.</p>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Create First Deal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal) => (
            <div key={deal._id} className="border rounded-lg p-4 bg-card">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{deal.name}</h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(deal)} aria-label="Edit">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(deal._id)} aria-label="Delete">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              {deal.description && <p className="text-sm text-muted-foreground mb-2">{deal.description}</p>}
              <p className="text-primary font-bold">
                Buy {deal.quantity} for ${deal.bundlePrice?.toFixed(2)}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {(deal.productIds || []).slice(0, 5).map((p: any) => (
                  <img
                    key={p._id || p}
                    src={getAdminThumbnail(p.images?.[0]?.url)}
                    alt={p.name || ""}
                    className="w-10 h-10 object-contain border rounded"
                  />
                ))}
                {(deal.productIds || []).length > 5 && (
                  <Badge variant="outline">+{(deal.productIds || []).length - 5}</Badge>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant={deal.status === 'active' ? 'default' : 'secondary'}>{deal.status}</Badge>
                {deal.displayOnHome && <Badge variant="outline">Home</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Deal" : "New Deal"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity Needed</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundlePrice">Bundle Price ($)</Label>
                <Input
                  id="bundlePrice"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.bundlePrice}
                  onChange={(e) => setForm({ ...form, bundlePrice: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startAt">Start (UTC)</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires (UTC)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="displayOnHome"
                checked={form.displayOnHome}
                onCheckedChange={(checked) => setForm({ ...form, displayOnHome: checked as boolean })}
              />
              <Label htmlFor="displayOnHome">Display on home page</Label>
            </div>

            <div className="space-y-2">
              <Label>Select Products</Label>
              <Input
                placeholder="Search products by name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="mb-2"
              />
              {productSearchLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
              <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {products.map((product) => (
                  <label
                    key={product._id}
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.productIds.includes(product._id)}
                      onChange={() => toggleProduct(product._id)}
                    />
                    <img
                      src={getAdminThumbnail(product.image?.url)}
                      alt={product.name}
                      className="w-8 h-8 object-contain"
                    />
                    <span className="text-sm truncate">{product.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deals;
