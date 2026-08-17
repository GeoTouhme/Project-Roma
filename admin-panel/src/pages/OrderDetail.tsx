import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/Table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Mail,
  Phone,
  Printer,
  Truck,
  User,
  Loader2,
  Package,
  XCircle,
  AlertTriangle,
  ClipboardList,
  RefreshCcw,
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
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [trackingUrlInput, setTrackingUrlInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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
      setActionLoading(true);
      const statusToSend = newStatus.toLowerCase();
      await ordersAPI.updateOrder(id, { status: statusToSend });
      toast.success(`Order status updated to ${newStatus}`);
      fetchOrder();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update order status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await ordersAPI.acceptOrder(id);
      toast.success("Order accepted. Staff can now request a driver.");
      fetchOrder();
    } catch (error: any) {
      console.error("Failed to accept order:", error);
      toast.error(error?.response?.data?.message || "Failed to accept order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!id) return;
    if (!denialReason.trim()) {
      toast.error("Please enter a reason for denial.");
      return;
    }
    try {
      setActionLoading(true);
      await ordersAPI.denyOrder(id, denialReason.trim());
      toast.success("Order denied and inventory restocked.");
      setDenyDialogOpen(false);
      setDenialReason("");
      fetchOrder();
    } catch (error: any) {
      console.error("Failed to deny order:", error);
      toast.error(error?.response?.data?.message || "Failed to deny order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendEmail = () => {
    toast.success("Email sent to customer");
  };

  const handleSaveTrackingUrl = async () => {
    if (!id || !trackingUrlInput.trim()) return;
    try {
      setActionLoading(true);
      await ordersAPI.updateOrder(id, { trackingUrl: trackingUrlInput.trim() });
      toast.success("Tracking link saved");
      setTrackingUrlInput("");
      fetchOrder();
    } catch (error) {
      console.error("Failed to save tracking URL:", error);
      toast.error("Failed to save tracking link");
    } finally {
      setActionLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-50 text-green-500 border-green-200";
      case "processing":
        return "bg-blue-50 text-blue-500 border-blue-200";
      case "shipped":
      case "ontheway":
        return "bg-indigo-50 text-indigo-500 border-indigo-200";
      case "cancelled":
      case "denied":
        return "bg-red-50 text-red-500 border-red-200";
      case "pending":
      default:
        return "bg-yellow-50 text-yellow-500 border-yellow-200";
    }
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

  const isPending = order.status === "pending";
  const isProcessing = order.status === "processing";
  const isDenied = order.status === "denied";

  return (
    <div className="space-y-6 w-full">
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Order</DialogTitle>
            <DialogDescription>
              Please enter a reason for denying this order. The reason will be saved for the store owner to review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="denial-reason">Denial Reason</Label>
            <Textarea
              id="denial-reason"
              placeholder="e.g. Out of stock, invalid address, customer request..."
              value={denialReason}
              onChange={(e) => setDenialReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeny} disabled={actionLoading || !denialReason.trim()}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Deny Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColor(order.status)}`}>
            <CheckCircle className="mr-2 h-4 w-4" />
            <span className="capitalize">{order.status}</span>
          </div>
        }
      />

      {/* Staff Action Alerts */}
      {isPending && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Action Required</AlertTitle>
          <AlertDescription className="text-yellow-700">
            This order is waiting for staff acceptance. Accept to prepare the order, or deny if it cannot be fulfilled.
          </AlertDescription>
        </Alert>
      )}

      {isProcessing && (
        <Alert className="border-blue-200 bg-blue-50">
          <Truck className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Driver Needed</AlertTitle>
          <AlertDescription className="text-blue-700">
            Order accepted. Please open the DoorDash or Uber Eats app and request a driver manually using the customer address below. Click "Mark as Shipped" once the driver is on the way.
          </AlertDescription>
        </Alert>
      )}

      {isDenied && order.staffDenialReason && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Order Denied</AlertTitle>
          <AlertDescription>
            <span className="font-medium">Reason:</span> {order.staffDenialReason}
            {order.staffDeniedAt && (
              <span className="block text-xs mt-1">
                Denied on {new Date(order.staffDeniedAt).toLocaleString()}
                {order.staffActionBy?.name && ` by ${order.staffActionBy.name}`}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {order.staffAcceptedAt && !isDenied && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Accepted by Staff</AlertTitle>
          <AlertDescription className="text-green-700">
            Accepted on {new Date(order.staffAcceptedAt).toLocaleString()}
            {order.staffActionBy?.name && ` by ${order.staffActionBy.name}`}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Order Details</TabsTrigger>
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
                  <p className="font-semibold">Delivery Address</p>
                  <p className="text-sm text-muted-foreground">
                    {order.user?.address}<br />
                    {order.user?.city}, {order.user?.state} {order.user?.zip}<br />
                    {order.user?.country || "Country not specified"}
                  </p>
                  {order.trackingUrl && (
                    <div className="pt-2">
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Tracking Link
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center">
                <Package className="mr-2 h-4 w-4" />
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
                        <img src={getAdminThumbnail(item.type === 'bundle' ? item.products?.[0]?.imageUrl : item.imageUrl)} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )
                  },
                  {
                    header: "Product",
                    accessorKey: (item: any) => (
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.type === 'bundle' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {(item.products || []).map((p: any) => (
                              <p key={p.pid}>{p.name} (Qty: {item.quantity})</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
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
                <CardTitle className="text-base font-medium flex items-center">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refund Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {order.refundId ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Refund ID</span>
                        <span className="text-sm font-medium text-xs font-mono text-green-600">{order.refundId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Refund Amount</span>
                        <span className="text-sm font-medium text-green-600">${Number(order.refundAmount)?.toFixed(2)}</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 p-2 rounded">
                        <CheckCircle className="h-3 w-3 mt-0.5" />
                        Refund processed successfully.
                      </div>
                    </>
                  ) : order.refundError ? (
                    <>
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                        <AlertTriangle className="h-3 w-3 mt-0.5" />
                        Refund failed: {order.refundError}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Please issue the refund manually in Stripe.
                      </p>
                    </>
                  ) : (
                    <div className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                      <AlertTriangle className="h-3 w-3 mt-0.5" />
                      No refund has been issued for this order yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Staff Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.staffNotes || "No notes"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Staff Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Staff Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={handleAccept}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Accept Order
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDenyDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Deny Order
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusUpdate("shipped")}
                    disabled={order.status === 'shipped' || order.status === 'delivered' || order.status === 'cancelled' || order.status === 'denied' || actionLoading}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="mr-2 h-4 w-4" />}
                    Mark as Shipped / Driver Requested
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusUpdate("delivered")}
                    disabled={order.status === 'delivered' || order.status === 'cancelled' || order.status === 'denied' || actionLoading}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Delivered
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleStatusUpdate("cancelled")}
                    disabled={order.status === 'cancelled' || order.status === 'denied' || order.status === 'delivered' || actionLoading}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Order
                  </Button>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <Label htmlFor="tracking-url" className="text-sm font-medium">Tracking / Driver Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="tracking-url"
                    placeholder="Paste DoorDash/Uber tracking link (optional)"
                    value={trackingUrlInput}
                    onChange={(e) => setTrackingUrlInput(e.target.value)}
                    disabled={actionLoading}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveTrackingUrl}
                    disabled={actionLoading || !trackingUrlInput.trim()}
                  >
                    Save
                  </Button>
                </div>
                {order.trackingUrl && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Current: {" "}
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {order.trackingUrl}
                    </a>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderDetail;
