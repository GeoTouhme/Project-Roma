import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { mixBundlesAPI } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FIELD_OPTIONS = [
  { value: "category", label: "Category" },
  { value: "size", label: "Size" },
  { value: "brand", label: "Brand" },
  { value: "tag", label: "Tag" },
];

const OPERATOR_OPTIONS = [
  { value: "equals", label: "Equals" },
  { value: "in", label: "Is one of" },
];

interface Condition {
  field: string;
  operator: string;
  value: string | string[];
}

interface MixBundle {
  _id: string;
  name: string;
  description?: string;
  conditions: Condition[];
  requiredQty: number;
  bundlePrice: number;
  startAt?: string;
  expiresAt?: string;
  status: "active" | "inactive";
}

const initialForm: Omit<MixBundle, "_id"> = {
  name: "",
  description: "",
  conditions: [{ field: "category", operator: "equals", value: "" }],
  requiredQty: 5,
  bundlePrice: 4.99,
  startAt: "",
  expiresAt: "",
  status: "active",
};

export default function MixBundles() {
  const navigate = useNavigate();
  const [bundles, setBundles] = useState<MixBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ _id: string; name: string }[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const fetchBundles = async () => {
    try {
      setLoading(true);
      const res = await mixBundlesAPI.getAll();
      if (res.data.success) setBundles(res.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load bundles");
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldValues = async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        mixBundlesAPI.getCategories(),
        mixBundlesAPI.getBrands(),
      ]);
      if (catRes.data.success) setCategories(catRes.data.data || []);
      if (brandRes.data.success) setBrands(brandRes.data.data || []);

      const sizeRes = await mixBundlesAPI.getFieldValues("size");
      if (sizeRes.data.success) setSizes(sizeRes.data.data || []);

      const tagRes = await mixBundlesAPI.getFieldValues("tags");
      if (tagRes.data.success) setTags(tagRes.data.data || []);
    } catch {
      // Non-blocking; fall back to free text.
    }
  };

  useEffect(() => {
    fetchBundles();
    fetchFieldValues();
  }, []);

  const resetForm = () => {
    setForm({
      ...initialForm,
      startAt: new Date().toLocaleString("sv-SE", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).slice(0, 16),
    });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (bundle: MixBundle) => {
    setForm({
      name: bundle.name,
      description: bundle.description || "",
      conditions: bundle.conditions.map((c) => ({
        ...c,
        value: Array.isArray(c.value) ? c.value : [c.value],
      })),
      requiredQty: bundle.requiredQty,
      bundlePrice: bundle.bundlePrice,
      startAt: bundle.startAt ? new Date(bundle.startAt).toLocaleString("sv-SE", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).slice(0, 16) : "",
      expiresAt: bundle.expiresAt ? new Date(bundle.expiresAt).toLocaleString("sv-SE", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).slice(0, 16) : "",
      status: bundle.status,
    });
    setEditingId(bundle._id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.conditions.length) {
      toast.error("At least one condition is required");
      return;
    }

    const payload = {
      ...form,
      conditions: form.conditions.map((c) => ({
        ...c,
        value:
          c.operator === "in"
            ? Array.isArray(c.value)
              ? c.value
              : String(c.value)
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean)
            : Array.isArray(c.value)
              ? c.value[0] || ""
              : String(c.value).trim(),
      })),
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };

    try {
      if (editingId) {
        await mixBundlesAPI.update(editingId, payload);
        toast.success("Bundle updated");
      } else {
        await mixBundlesAPI.create(payload);
        toast.success("Bundle created");
      }
      setDialogOpen(false);
      resetForm();
      fetchBundles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save bundle");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bundle?")) return;
    try {
      await mixBundlesAPI.delete(id);
      toast.success("Bundle deleted");
      fetchBundles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete bundle");
    }
  };

  const updateCondition = (index: number, key: keyof Condition, value: any) => {
    setForm((prev) => {
      const conditions = [...prev.conditions];
      const current = conditions[index];
      const updated: Condition = { ...current, [key]: value };
      if (key === "operator") {
        updated.value = value === "in" ? [] : "";
      }
      if (key === "field") {
        updated.value = value === "tag" || updated.operator === "in" ? [] : "";
      }
      conditions[index] = updated;
      return { ...prev, conditions };
    });
  };

  const addCondition = () => {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: "category", operator: "equals", value: "" }],
    }));
  };

  const removeCondition = (index: number) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const getValueOptions = (field: string) => {
    switch (field) {
      case "category":
        return categories.map((c) => ({ value: c._id, label: c.name }));
      case "brand":
        return brands.map((b) => ({ value: b._id, label: b.name }));
      case "size":
        return sizes.map((s) => ({ value: s, label: s }));
      case "tag":
        return tags.map((t) => ({ value: t, label: t }));
      default:
        return [];
    }
  };

  const renderConditionValue = (condition: Condition, index: number) => {
    const options = getValueOptions(condition.field);
    const isMulti = condition.operator === "in" || condition.field === "tag";

    if (options.length > 0) {
      return (
        <Select
          value={
            isMulti
              ? Array.isArray(condition.value) && condition.value.length
                ? condition.value.join(",")
                : ""
              : Array.isArray(condition.value)
                ? condition.value[0] || ""
                : condition.value || ""
          }
          onValueChange={(val) =>
            updateCondition(
              index,
              "value",
              isMulti ? val.split(",").filter(Boolean) : val
            )
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isMulti ? "Select values" : "Select value"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (isMulti) {
      return (
        <Input
          placeholder="Comma-separated values"
          value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value}
          onChange={(e) =>
            updateCondition(
              index,
              "value",
              e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            )
          }
        />
      );
    }

    return (
      <Input
        placeholder="Value"
        value={Array.isArray(condition.value) ? condition.value[0] || "" : condition.value}
        onChange={(e) => updateCondition(index, "value", e.target.value)}
      />
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Mix & Match Bundles"
        description="Create rule-based bundles: any product matching the conditions qualifies automatically."
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Bundle
          </Button>
        }
      />

      {bundles.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No mix & match bundles yet. Click "New Bundle" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bundles.map((bundle) => (
            <Card key={bundle._id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>{bundle.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={bundle.status === "active" ? "default" : "secondary"}>
                      {bundle.status}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(bundle)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(bundle._id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{bundle.description}</p>
                <div className="flex flex-wrap gap-2">
                  {bundle.conditions.map((c, i) => (
                    <Badge key={i} variant="outline">
                      {c.field} {c.operator} {Array.isArray(c.value) ? c.value.join(" | ") : c.value}
                    </Badge>
                  ))}
                </div>
                <p>
                  Buy {bundle.requiredQty} for ${bundle.bundlePrice.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Bundle" : "New Bundle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Conditions (AND)</Label>
              {form.conditions.map((condition, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Select
                      value={condition.field}
                      onValueChange={(val) => updateCondition(index, "field", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={condition.operator}
                      onValueChange={(val) => updateCondition(index, "operator", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5">{renderConditionValue(condition, index)}</div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addCondition} className="w-full">
                Add Condition
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="requiredQty">Required Quantity</Label>
                <Input
                  id="requiredQty"
                  type="number"
                  min={1}
                  value={form.requiredQty}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, requiredQty: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bundlePrice">Bundle Price ($)</Label>
                <Input
                  id="bundlePrice"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.bundlePrice}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, bundlePrice: Number(e.target.value) }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startAt">Start (Local Time)</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiresAt">Expires (Local Time)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, status: val as "active" | "inactive" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} className="w-full">
              {editingId ? "Update Bundle" : "Create Bundle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
