import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/Table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Mail,
  Phone,
  Printer,
  Truck,
  User,
  Loader2
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { ordersAPI } from "@/lib/api";
import { getAdminThumbnail } from "@/lib/utils";
import { toast } from "sonner";

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [order, setOrder] = useState<any>(null);

  const fetchOrder = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const response = await ordersAPI.getOrderById(id);
      if (response.data.success) {
        setOrder(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch order:", error);
      toast.error("Failed to load order details");
      navigate("/orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!id) return;
    try {
      // Backend uses specific strings, we might need to map them if they differ from UI
      // Assuming backend accepts these strings: "Processing", "Shipped", "Delivered", "Cancelled"
      // But standardizing to lowercase if backend expects specific enum
      const statusToSend = newStatus.toLowerCase();

      await ordersAPI.updateOrder(id, { status: statusToSend });
      toast.success(`Order status updated to ${newStatus}`);
      fetchOrder(); // Refresh data
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update order status");
    }
  };

  const handleSendEmail = () => {
    toast.success("Email sent to customer");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin w-12 h-12 text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-xl text-muted-foreground mb-4">Order not found</p>
        <Button onClick={() => navigate("/orders")}>Back to Orders</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => navigate("/orders")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {/* Email functionality placeholder */}
          <Button size="sm" onClick={() => handleSendEmail()} disabled>
            <Mail className="mr-2 h-4 w-4" />
            Email Customer (Coming Soon)
          </Button>
        </div>
      </div>

      <PageHeader
        title={`Order ${order.orderNo || order._id.substring(0, 8)}`}
        description={`Placed on ${new Date(order.createdAt).toLocaleDateString()}`}
        actions={
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border
             ${order.status === 'delivered' ? 'bg-green-50 text-green-500 border-green-200' :
              order.status === 'cancelled' ? 'bg-red-50 text-red-500 border-red-200' :
                order.status === 'processing' ? 'bg-blue-50 text-blue-500 border-blue-200' :
                  'bg-yellow-50 text-yellow-500 border-yellow-200'
            }`}>
            <CheckCircle className="mr-2 h-4 w-4" />
            <span className="capitalize">{order.status}</span>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Order Details</TabsTrigger>
          {/* <TabsTrigger value="timeline">Timeline</TabsTrigger> Backend doesn't support timeline yet */}
        </TabsList>

        <TabsContent value="details" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Customer Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-semibold">{order.user?.firstName} {order.user?.lastName}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4" />
                    {order.user?.email}
                  </div>
                  {order.user?.phone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="mr-2 h-4 w-4" />
                      {order.user?.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shipping Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center">
                  <Truck className="mr-2 h-4 w-4" />
                  Shipping Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-semibold">Shipping Address</p>
                  <p className="text-sm text-muted-foreground">
                    {order.user?.address}<br />
                    {order.user?.city} {order.user?.zip}<br />
                    {order.user?.country || "Country not specified"}
                  </p>
                  <div className="pt-2">
                    {/* Method and Tracking - placeholders if backend data missing */}
                    {/* 
                    <p className="text-sm">
                      <span className="font-medium">Method:</span>{" "}
                      {order.shippingMethod || "Standard"}
                    </p>
                     
                    <p className="text-sm flex items-center">
                      <span className="font-medium mr-1">Tracking:</span>
                      {order.trackingNumber || "N/A"}
                    </p>
                    */}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table
                data={order.items || []}
                columns={[
                  {
                    header: "Image",
                    accessorKey: (item: any) => (
                      <div className="w-12 h-12 rounded overflow-hidden bg-muted">
                        <img src={getAdminThumbnail(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )
                  },
                  {
                    header: "Product",
                    accessorKey: "name",
                    className: "font-medium",
                  },
                  {
                    header: "Quantity",
                    accessorKey: "quantity",
                    className: "text-center",
                  },
                  {
                    header: "Unit Price",
                    accessorKey: (item: any) => `$${(item.total / item.quantity).toFixed(2)}`,
                    className: "text-right",
                  },
                  {
                    header: "Total",
                    accessorKey: (item: any) => `$${item.total?.toFixed(2)}`,
                    className: "text-right",
                  },
                ]}
              // onRowClick={(item) => console.log(`View product ${item.pid}`)}
              />

              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${order.subTotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>${Number(order.shipping)?.toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="text-muted-foreground">Discount</span>
                    <span>-${order.discount?.toFixed(2)}</span>
                  </div>
                )}
                {/* Tax not explicitly in model, assuming included or not applicable for now
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>$0.00</span>
                </div>
                */}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>${order.total?.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Method
                    </span>
                    <span className="text-sm font-medium capitalize">
                      {order.paymentMethod}
                    </span>
                  </div>
                  {order.paymentId && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Transaction ID
                      </span>
                      <span className="text-sm font-medium text-xs font-mono">
                        {order.paymentId}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Status
                    </span>
                    <span className="text-sm font-medium text-green-500">
                      Paid
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {order.notes || "No notes"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Update Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Update Order Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate("processing")}
                  disabled={order.status === 'processing'}
                >
                  Mark as Processing
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate("shipped")}
                  disabled={order.status === 'shipped'}
                >
                  Mark as Shipped
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate("delivered")}
                  disabled={order.status === 'delivered'}
                >
                  Mark as Delivered
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleStatusUpdate("cancelled")}
                  disabled={order.status === 'cancelled'}
                >
                  Cancel Order
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="pt-4">
          {/* Timeline content reserved for future implementation */}
          <div className="p-8 text-center text-muted-foreground">
            Timeline history is not available for this order.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderDetail;
