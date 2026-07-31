import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/lib/toast";
import { customersAPI } from "@/lib/api";
import { format } from "date-fns";

const CustomerForm = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("active");
  const [isVerified, setIsVerified] = useState(false);
  const [role, setRole] = useState("user");
  const [createdAt, setCreatedAt] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await customersAPI.getCustomerById(id);
        if (response.data.success) {
          const userData = response.data.user;
          setFirstName(userData.firstName || "");
          setLastName(userData.lastName || "");
          setEmail(userData.email || "");
          setPhone(userData.phone || "");
          setStatus(userData.status || "active");
          setIsVerified(!!userData.isVerified);
          setRole(userData.role || "user");
          setCreatedAt(
            userData.createdAt
              ? format(new Date(userData.createdAt), "MMM d, yyyy")
              : "N/A"
          );
        } else {
          toast.error("Failed to load customer details");
        }
      } catch (error: any) {
        console.error("Failed to fetch customer:", error);
        toast.error(error?.response?.data?.message || "Failed to load customer details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  const handleSave = async () => {
    if (!firstName || !lastName || !email) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        firstName,
        lastName,
        email,
        phone,
        status,
        isVerified,
        role,
      };

      if (id) {
        await customersAPI.updateCustomer(id, payload);
        toast.success("Customer updated successfully!");
      } else {
        // Future: add admin customer creation endpoint
        toast.error("Creating customers from the admin panel is not yet supported.");
        setIsSaving(false);
        return;
      }

      navigate("/customers");
    } catch (error: any) {
      console.error("Failed to save customer:", error);
      toast.error(error?.response?.data?.message || "Failed to save customer");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin-slow w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => navigate("/customers")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>

        {/* Save Button */}
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Customer"}
        </Button>
      </div>

      {/* Page Header */}
      <PageHeader
        title={id ? "Edit Customer" : "Add Customer"}
        description={
          id ? "Update customer details." : "Add a new customer to the system."
        }
      />

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                placeholder="Enter first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                placeholder="Enter last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="Enter phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Verified */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="verified">Email Verified</Label>
              <p className="text-sm text-muted-foreground">
                Mark this customer as having a verified email address.
              </p>
            </div>
            <Switch
              id="verified"
              checked={isVerified}
              onCheckedChange={setIsVerified}
            />
          </div>

          {/* Created At */}
          {id && (
            <div className="space-y-2">
              <Label>Created At</Label>
              <Input value={createdAt} disabled readOnly />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerForm;
