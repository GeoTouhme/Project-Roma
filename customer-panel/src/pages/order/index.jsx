import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import OrderService from "../../services/orderService";
import { getThumbnailImage } from "../../utils/cloudinary";
import { RiUserFill, RiTruckFill } from "react-icons/ri";
import { FaDollarSign } from "react-icons/fa6";
import { FaExternalLinkAlt, FaCheckCircle, FaTimesCircle, FaHourglassHalf } from "react-icons/fa";
import { Dialog } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const OrderPage = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelling, setCancelling] = useState(false);

    const fetchOrder = useCallback(() => {
        if (!id) return;
        OrderService.getOrderById(id)
            .then((response) => {
                if (response?.success) {
                    setOrder(response.data);
                }
            })
            .catch((error) => {
                console.error("Order fetch error:", error);
            });
    }, [id]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    const handleCancelOrder = async () => {
        if (!cancelReason.trim()) {
            toast.error("Please enter a reason for cancellation.");
            return;
        }
        setCancelling(true);
        try {
            const response = await OrderService.cancelOrder(id, cancelReason.trim());
            if (response?.success) {
                toast.success(response.message || "Order cancelled.");
                setCancelModalOpen(false);
                fetchOrder();
            } else {
                toast.error(response?.message || "Failed to cancel order.");
            }
        } catch (error) {
            console.error("Cancel order error:", error);
            toast.error(error?.message || "Failed to cancel order.");
        } finally {
            setCancelling(false);
        }
    };

    if (!order) return <p className="text-center mt-10">Loading...</p>;

    const {
        orderNo,
        items,
        subTotal,
        total,
        shipping,
        discount,
        paymentMethod,
        status,
        createdAt,
        user,
        deliveryId,
        trackingUrl,
        deliveryStatus,
        estimatedDeliveryTime,
        staffDenialReason,
        customerCancellationReason,
        refundId,
    } = order;

    const statusConfig = {
        pending: {
            icon: <FaHourglassHalf />,
            title: "Order Received",
            message: "We've received your order and are waiting for store confirmation.",
            color: "text-yellow-600",
            bg: "bg-yellow-50",
            border: "border-yellow-200",
        },
        processing: {
            icon: <FaCheckCircle />,
            title: "Order Accepted",
            message: "Your order has been accepted and is being prepared for delivery.",
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-200",
        },
        shipped: {
            icon: <RiTruckFill />,
            title: "Out for Delivery",
            message: "Your order is on the way! Track your delivery below.",
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            border: "border-indigo-200",
        },
        ontheway: {
            icon: <RiTruckFill />,
            title: "Out for Delivery",
            message: "Your order is on the way! Track your delivery below.",
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            border: "border-indigo-200",
        },
        delivered: {
            icon: <FaCheckCircle />,
            title: "Delivered",
            message: "Your order has been delivered. Thank you for shopping with us!",
            color: "text-green-600",
            bg: "bg-green-50",
            border: "border-green-200",
        },
        cancelled: {
            icon: <FaTimesCircle />,
            title: "Order Cancelled",
            message: customerCancellationReason
                ? `Reason: ${customerCancellationReason}`
                : "This order has been cancelled. Contact us if you need assistance.",
            color: "text-red-600",
            bg: "bg-red-50",
            border: "border-red-200",
        },
        denied: {
            icon: <FaTimesCircle />,
            title: "Order Cancelled by Store",
            message: staffDenialReason
                ? `Reason: ${staffDenialReason}`
                : "This order could not be fulfilled by the store. Contact us for more information.",
            color: "text-red-600",
            bg: "bg-red-50",
            border: "border-red-200",
        },
        delivery_failed: {
            icon: <FaTimesCircle />,
            title: "Delivery Issue",
            message: "We encountered an issue with delivery. Our team will contact you.",
            color: "text-red-600",
            bg: "bg-red-50",
            border: "border-red-200",
        },
    };

    const currentStatus = statusConfig[status] || statusConfig.pending;

    return (
        <div className="px-4 sm:px-10 py-10 container">
            <AnimatePresence>
                {cancelModalOpen && (
                    <Dialog open={cancelModalOpen} onClose={() => !cancelling && setCancelModalOpen(false)} className="relative z-50">
                        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
                        <div className="fixed inset-0 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="w-full max-w-md"
                            >
                                <Dialog.Panel className="rounded-2xl bg-white p-6 shadow-lg">
                                    <Dialog.Title className="text-xl font-semibold text-gray-800 mb-2">
                                        Cancel Order
                                    </Dialog.Title>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Are you sure? You can only cancel before the store accepts your order.
                                    </p>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason for cancellation</label>
                                    <textarea
                                        className="w-full border border-gray-300 rounded-md p-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-[#B5223B]"
                                        placeholder="Tell us why you're cancelling..."
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        disabled={cancelling}
                                    />
                                    <div className="flex justify-end gap-2 mt-6">
                                        <button
                                            className="px-4 py-2 rounded-md border text-gray-700 border-gray-300 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => setCancelModalOpen(false)}
                                            disabled={cancelling}
                                        >
                                            Keep Order
                                        </button>
                                        <button
                                            className="cursor-pointer px-4 py-2 rounded-md disabled:cursor-not-allowed disabled:bg-[#B5223B]/60 bg-[#B5223B] text-white font-semibold hover:bg-[#9e1e32] flex items-center justify-center gap-2 min-w-[120px]"
                                            onClick={handleCancelOrder}
                                            disabled={!cancelReason.trim() || cancelling}
                                        >
                                            {cancelling ? "Cancelling..." : "Cancel Order"}
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </motion.div>
                        </div>
                    </Dialog>
                )}
            </AnimatePresence>

            <div className="flex justify-center text-center">
                <div className="mb-10 max-w-2xl">
                    <h1 className="text-3xl font-bold text-black mb-2">
                        {status === 'cancelled' || status === 'denied' ? 'Order Update' : 'Thank you for your purchase!'}
                    </h1>
                    <p className="text-gray-600 mb-2">
                        {status === 'cancelled' || status === 'denied'
                            ? 'This order has been cancelled. A refund will be processed if payment was already collected.'
                            : 'Thank you for choosing us! Your purchase is appreciated. We\'re committed to providing top-notch products and service.'}
                    </p>
                    <p className="text-lg text-primary font-semibold">
                        Order Number: {orderNo}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Order Items Table */}
                <div className="lg:col-span-2 bg-white rounded-md shadow p-4 overflow-x-auto">
                    <h2 className="text-lg font-semibold mb-4">
                        {items?.length} Item{items.length > 1 ? "s" : ""}
                    </h2>
                    <table className="min-w-full border">
                        <thead>
                            <tr className="bg-primary text-white text-left text-sm">
                                <th className="p-3">Product</th>
                                <th className="p-3">Quantity</th>
                                <th className="p-3">Price</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {items.map((item) => (
                                <tr key={item._id} className="border-t">
                                    <td className="p-3 flex items-center gap-3">
                                        <img src={getThumbnailImage(item.imageUrl)} alt={item.name} className="w-12 h-12 object-cover rounded" loading="lazy" />
                                        <span>{item.name}</span>
                                    </td>
                                    <td className="p-3">{item.quantity}</td>
                                    <td className="p-3">${item.total.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="mt-4 border-t pt-4 space-y-4 text-sm flex flex-col items-end">
                        <div className="w-[200px] flex items-center justify-between">Subtotal: <span className="font-medium">${subTotal.toFixed(2)}</span></div>
                        <div className="w-[200px] flex items-center justify-between">Shipping Fee: <span className="font-medium">${shipping.toFixed(2)}</span></div>
                        <div className="w-[200px] flex items-center justify-between">Discount: <span className="font-medium text-green-600">-${discount.toFixed(2)}</span></div>
                        <div className="text-lg font-bold w-[200px] flex items-center justify-between">
                            Total: <span className="text-black">${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Right Panels */}
                <div className="space-y-4">
                    {/* Order Status */}
                    <div className={`${currentStatus.bg} ${currentStatus.border} border rounded-md p-4 shadow-md`}>
                        <h3 className={`${currentStatus.color} text-lg font-bold mb-3 flex items-center gap-2`}>
                            {currentStatus.icon} {currentStatus.title}
                        </h3>
                        <p className="text-sm text-gray-700">
                            {currentStatus.message}
                        </p>
                        <div className="pt-2 border-t border-gray-200/50 mt-3 flex justify-between items-center text-xs">
                            <span className="text-gray-500 uppercase font-semibold">Order Status:</span>
                            <span className={`${currentStatus.color} px-2 py-1 rounded-full font-bold bg-white`}>
                                {status?.replace(/_/g, ' ')?.toUpperCase()}
                            </span>
                        </div>

                        {status === 'pending' && (
                            <button
                                onClick={() => setCancelModalOpen(true)}
                                className="mt-4 w-full py-2 px-4 rounded border border-red-500 text-red-600 hover:bg-red-50 font-medium text-sm transition"
                            >
                                Cancel Order
                            </button>
                        )}

                        {refundId && (
                            <div className="mt-3 text-xs text-gray-600">
                                Refund issued: <span className="font-mono">{refundId}</span>
                            </div>
                        )}
                    </div>

                    {/* Delivery Tracking Info */}
                    {trackingUrl && (
                        <div className="bg-white border-2 border-primary rounded-md p-4 shadow-md animate-pulse-slow">
                            <h3 className="text-primary text-lg font-bold mb-3 flex items-center gap-2">
                                <RiTruckFill /> Live Delivery Tracking
                            </h3>
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">
                                    Your order is being delivered. Click below to track your driver in real-time.
                                </p>
                                <a
                                    href={trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 bg-primary text-white py-3 px-4 rounded-lg font-bold hover:bg-opacity-90 transition-all shadow-sm w-full"
                                >
                                    Track My Delivery <FaExternalLinkAlt size={14} />
                                </a>
                                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                                    <span className="text-gray-500 uppercase font-semibold">Status:</span>
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                                        {deliveryStatus?.replace(/_/g, ' ') || "DISPATCHED"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 uppercase font-semibold">Support ID:</span>
                                    <span className="text-gray-800 font-mono">{deliveryId}</span>
                                </div>
                                {estimatedDeliveryTime && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 uppercase font-semibold">ETA:</span>
                                        <span className="text-gray-800 font-semibold">
                                            {new Date(estimatedDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Customer Info */}
                    <div className="bg-primary text-white rounded-md p-4 shadow">
                        <h3 className="text-white text-lg font-semibold mb-3 flex items-center gap-2">
                            <RiUserFill />Customer Details
                        </h3>
                        <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
                        <p><strong>Phone:</strong> {user.phone}</p>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Address:</strong> {user.address}, {user.state} {user.city}, {user.country}</p>
                    </div>

                    {/* Payment Info */}
                    <div className="bg-primary text-white rounded-md p-4 shadow">
                        <h3 className="text-white text-lg font-semibold mb-3 flex items-center gap-2">
                            <FaDollarSign /> Payment Method
                        </h3>
                        <p><strong>Method:</strong> {paymentMethod}</p>
                        <p><strong>Status:</strong> Paid</p>
                        <p><strong>Shipping Fee:</strong> ${shipping.toFixed(2)}</p>
                        <p><strong>Order Date:</strong> {new Date(createdAt).toDateString()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderPage;
