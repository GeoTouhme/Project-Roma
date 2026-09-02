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
import { Badge } from "@/components/ui/badge";
import { couponsAPI } from "@/lib/api";
import { Plus, Pencil, Trash2, Ticket, Users } from "lucide-react";

interface UsageEntry {
  user?: string;
  email?: string;
  name?: string;
  orderId?: string;
  orderNo?: string;
  total?: number;
  discount?: number;
  date?: string;
}

interface Coupon {
  _id: string;
  name: string;
  code: string;
  discount: number;
  type: "percent" | "fixed";
  expire: string;
  description?: string;
  maxUses?: number;
  minOrderAmount?: number;
  usedBy: string[];
  usageHistory?: UsageEntry[];
  createdAt: string;
}

const initialForm = {
  name: "",
  code: "",
  discount: 0,
  type: "percent" as "percent" | "fixed",
  expire: "",
  description: "",
  maxUses: 0,
  minOrderAmount: 0,
};

const Coupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [usageCoupon, setUsageCoupon] = useState<Coupon | null>(null);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await couponsAPI.getAll({ limit: 100 });
      if (res.data.success) setCoupons(res.data.data || []);
    } catch (error) {
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const resetForm = () => {
    setForm({
      ...initialForm,
      expire: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toLocaleString("sv-SE", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
        .slice(0, 16),
    });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingId(coupon._id);
    setForm({
      name: coupon.name || "",
      code: coupon.code || "",
      discount: coupon.discount || 0,
      type: coupon.type || "percent",
      expire: coupon.expire
        ? new Date(coupon.expire).toLocaleString("sv-SE", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).slice(0, 16)
        : "",
      description: coupon.description || "",
      maxUses: coupon.maxUses || 0,
      minOrderAmount: coupon.minOrderAmount || 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.discount <= 0) {
      toast.error("Discount must be greater than 0");
      return;
    }
    if (form.type === "percent" && form.discount > 100) {
      toast.error("Percent discount cannot exceed 100");
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      discount: Number(form.discount),
      type: form.type,
      expire: form.expire ? new Date(form.expire).toISOString() : undefined,
      description: form.description.trim() || undefined,
      maxUses: Number(form.maxUses) > 0 ? Number(form.maxUses) : undefined,
      minOrderAmount: Number(form.minOrderAmount) > 0 ? Number(form.minOrderAmount) : undefined,
    };

    try {
      if (editingId) {
        await couponsAPI.update(editingId, payload);
        toast.success("Coupon updated");
      } else {
        await couponsAPI.create(payload);
        toast.success("Coupon created");
      }
      setDialogOpen(false);
      resetForm();
      fetchCoupons();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save coupon");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this coupon?")) return;
    try {
      await couponsAPI.delete(id);
      toast.success("Coupon deleted");
      fetchCoupons();
    } catch (error) {
      toast.error("Failed to delete coupon");
    }
  };

  const isExpired = (expire: string) => new Date(expire) < new Date();

  const openUsage = async (coupon: Coupon) => {
    try {
      const res = await couponsAPI.getById(coupon._id);
      if (res.data.success) {
        setUsageCoupon(res.data.data);
        setUsageDialogOpen(true);
      }
    } catch (error) {
      toast.error("Failed to load usage data");
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.type === "percent") return `${coupon.discount}% off`;
    return `$${coupon.discount.toFixed(2)} off`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <PageHeader
        title="Coupon Codes"
        description="Create and manage promotional coupon codes"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Coupon
          </Button>
        }
      />

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : coupons.length === 0 ? (
        <div className="border rounded-lg p-8 text-center bg-card">
          <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No coupons created yet.</p>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Create First Coupon
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon.expire);
            const usageCount = coupon.usedBy?.length || 0;
            const maxReached =
              coupon.maxUses && coupon.maxUses > 0 && usageCount >= coupon.maxUses;

            return (
              <div key={coupon._id} className="border rounded-lg p-4 bg-card">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">{coupon.name}</h3>
                    <p className="text-sm font-mono text-primary mt-1">
                      {coupon.code}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openUsage(coupon)}
                      aria-label="View usage"
                      title="View usage"
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(coupon)}
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(coupon._id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {coupon.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {coupon.description}
                  </p>
                )}

                <p className="text-primary font-bold">{formatDiscount(coupon)}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={expired ? "destructive" : "default"}>
                    {expired ? "Expired" : "Active"}
                  </Badge>
                  {maxReached && (
                    <Badge variant="secondary">Max uses reached</Badge>
                  )}
                  {coupon.maxUses && coupon.maxUses > 0 ? (
                    <Badge variant="outline">
                      Used {usageCount}/{coupon.maxUses}
                    </Badge>
                  ) : (
                    usageCount > 0 && (
                      <Badge variant="outline">Used {usageCount}x</Badge>
                    )
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Expires:{" "}
                  {new Date(coupon.expire).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Coupon" : "New Coupon"}</DialogTitle>
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
                  placeholder="Summer Sale 10%"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code (leave blank to auto-generate)</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  className="uppercase"
                  placeholder="SUMMER10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount Value</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.discount}
                  onChange={(e) =>
                    setForm({ ...form, discount: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as "percent" | "fixed",
                    })
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses (0 = unlimited)</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min={0}
                  value={form.maxUses}
                  onChange={(e) =>
                    setForm({ ...form, maxUses: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minOrderAmount">Minimum Order Amount ($, 0 = none)</Label>
              <Input
                id="minOrderAmount"
                type="number"
                step="0.01"
                min={0}
                value={form.minOrderAmount}
                onChange={(e) =>
                  setForm({ ...form, minOrderAmount: Number(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expire">Expiry Date (Local Time)</Label>
              <Input
                id="expire"
                type="datetime-local"
                value={form.expire}
                onChange={(e) => setForm({ ...form, expire: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                placeholder="Internal note or customer-facing description"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingId ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Usage History Dialog */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Coupon Usage — {usageCoupon?.name}{" "}
              <span className="text-sm font-mono text-muted-foreground">
                ({usageCoupon?.code})
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="border rounded-lg p-3 bg-card flex-1 min-w-[120px]">
                <p className="text-muted-foreground">Total Uses</p>
                <p className="text-2xl font-bold text-primary">
                  {usageCoupon?.usageHistory?.length || 0}
                </p>
              </div>
              <div className="border rounded-lg p-3 bg-card flex-1 min-w-[120px]">
                <p className="text-muted-foreground">Unique Customers</p>
                <p className="text-2xl font-bold text-primary">
                  {new Set(
                    (usageCoupon?.usageHistory || []).map((u) => u.email).filter(Boolean)
                  ).size}
                </p>
              </div>
              <div className="border rounded-lg p-3 bg-card flex-1 min-w-[120px]">
                <p className="text-muted-foreground">Total Discount Given</p>
                <p className="text-2xl font-bold text-primary">
                  $
                  {(
                    (usageCoupon?.usageHistory || []).reduce(
                      (sum, u) => sum + (u.discount || 0),
                      0
                    )
                  ).toFixed(2)}
                </p>
              </div>
              <div className="border rounded-lg p-3 bg-card flex-1 min-w-[120px]">
                <p className="text-muted-foreground">Total Order Revenue</p>
                <p className="text-2xl font-bold text-primary">
                  $
                  {(
                    (usageCoupon?.usageHistory || []).reduce(
                      (sum, u) => sum + (u.total || 0),
                      0
                    )
                  ).toFixed(2)}
                </p>
              </div>
            </div>

            {(usageCoupon?.usageHistory || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                This coupon has not been used yet.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-semibold">Customer</th>
                      <th className="text-left p-3 font-semibold">Order</th>
                      <th className="text-right p-3 font-semibold">Discount</th>
                      <th className="text-right p-3 font-semibold">Order Total</th>
                      <th className="text-left p-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(usageCoupon?.usageHistory || [])]
                      .sort(
                        (a, b) =>
                          new Date(b.date || 0).getTime() -
                          new Date(a.date || 0).getTime()
                      )
                      .map((entry, i) => (
                        <tr
                          key={i}
                          className="border-t hover:bg-muted/50"
                        >
                          <td className="p-3">
                            <div className="font-medium">
                              {entry.name || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.email || ""}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {entry.orderNo || entry.orderId?.slice(-8) || "—"}
                          </td>
                          <td className="p-3 text-right text-green-600 font-medium">
                            ${(entry.discount || 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-medium">
                            ${(entry.total || 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {entry.date
                              ? new Date(entry.date).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Coupons;