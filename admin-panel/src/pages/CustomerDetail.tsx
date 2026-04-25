import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "@/lib/toast";
import { customersAPI } from "@/lib/api";
import { format } from "date-fns";

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const response = await customersAPI.getCustomerById(id);
        if (response.data.success) {
          const userData = response.data.user;
          // Map backend data to component state
          setCustomer({
            id: userData._id,
            name: `${userData.firstName} ${userData.lastName}`,
            email: userData.email,
            status: userData.isVerified ? "Active" : "Inactive", // Using isVerified as status source
            createdAt: userData.createdAt ? format(new Date(userData.createdAt), "MMM d, yyyy") : "N/A",
            // Preserve other fields if needed later
            ...userData
          });
        }
      } catch (error) {
        console.error("Failed to fetch customer:", error);
        toast.error("Failed to load customer details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  const handleDelete = async () => {
    if (!customer?.id) return;

    try {
      await customersAPI.deleteCustomer(customer.id);
      toast.success(`Customer ${customer?.name} deleted`);
      navigate("/customers");
    } catch (error) {
      console.error("Failed to delete customer:", error);
      toast.error("Failed to delete customer");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin-slow w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!customer) {
    return <div className="text-center">Customer not found.</div>;
  }

  return (
    <div className="space-y-6 w-full">
      {/* Back and Actions */}
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

        <div className="flex gap-2">
          {/* Edit Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/customers/edit/${customer.id}`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Customer
          </Button>

          {/* Delete Button */}
          <Button
            size="sm"
            variant="outline"
            className="text-red-500 hover:text-red-700"
            onClick={handleDelete}
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete Customer
          </Button>
        </div>
      </div>

      {/* Page Header */}
      <PageHeader
        title={customer.name}
        description={`Created on ${customer.createdAt}`}
        actions={
          <div
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${customer.status === "Active"
              ? "bg-green-50 text-green-500 border-green-200"
              : "bg-red-50 text-red-500 border-red-200"
              }`}
          >
            {customer.status}
          </div>
        }
      />

      {/* Customer Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{customer.name}</span>
          </div>

          {/* Email */}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{customer.email}</span>
          </div>

          {/* Status */}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span
              className={`text-sm font-medium ${customer.status === "Active" ? "text-green-500" : "text-red-500"
                }`}
            >
              {customer.status}
            </span>
          </div>

          {/* Created At */}
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Created At</span>
            <span className="text-sm font-medium">{customer.createdAt}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerDetail;
