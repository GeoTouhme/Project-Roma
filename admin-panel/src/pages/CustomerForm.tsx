import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/lib/toast";

// Sample customer data (for editing)
const sampleCustomer = {
  id: "CUST-001",
  name: "John Doe",
  email: "john.doe@example.com",
  status: "active",
  createdAt: "2023-01-10",
};

const CustomerForm = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("active");
  const [createdAt, setCreatedAt] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      // Load customer details for editing (mock)
      setTimeout(() => {
        setName(sampleCustomer.name);
        setEmail(sampleCustomer.email);
        setStatus(sampleCustomer.status);
        setCreatedAt(sampleCustomer.createdAt);
        setIsLoading(false);
      }, 1000);
    } else {
      setIsLoading(false);
    }
  }, [id]);

  const handleSave = () => {
    if (!name || !email) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Mock save to API
    setTimeout(() => {
      if (id) {
        toast.success("Customer updated successfully!");
      } else {
        toast.success("Customer created successfully!");
      }
      navigate("/customers");
    }, 1000);
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
        <Button size="sm" onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Customer
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
          {/* Name */}
          <Input
            placeholder="Enter customer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Email */}
          <Input
            // label="Email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* Status */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Created At */}
          {id && <Input value={createdAt} disabled readOnly />}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerForm;
