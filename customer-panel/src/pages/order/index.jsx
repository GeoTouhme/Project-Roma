import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import OrderService from "../../services/orderService";
import { RiUserFill, RiTruckFill } from "react-icons/ri";
import { FaDollarSign } from "react-icons/fa6";
import { FaExternalLinkAlt } from "react-icons/fa";

const OrderPage = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);

    useEffect(() => {
        if (!id) return;

        const fetchOrder = () => {
            OrderService.getOrderById(id)
                .then((response) => {
                    if (response?.success) {
                        setOrder(response.data);
                        // If trackingUrl is still missing, retry in 3 seconds (up to 3 times)
                        if (!response.data.trackingUrl && response.data.status !== 'delivery_failed') {
                            setTimeout(fetchOrder, 3000);
                        }
                    }
                })
                .catch((error) => {
                    console.error("Order fetch error:", error);
                });
        };

        fetchOrder();
    }, [id]);

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
    } = order;

    return (
        <div className="px-4 sm:px-10 py-10 container">
            <div className="flex justify-center text-center">
                <div className="mb-10 max-w-2xl">
                    <h1 className="text-3xl font-bold text-black mb-2">
                        Thank you for your purchase!
                    </h1>
                    <p className="text-gray-600 mb-2">
                        Thank you for choosing us! Your purchase is appreciated. We're committed to
                        providing top-notch products and service. Stay tuned for updates on your order.
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
                                {/* <th className="p-3">Color</th>
                                <th className="p-3">Size</th> */}
                                <th className="p-3">Quantity</th>
                                <th className="p-3">Price</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {items.map((item) => (
                                <tr key={item._id} className="border-t">
                                    <td className="p-3 flex items-center gap-3">
                                        <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded" />
                                        <span>{item.name}</span>
                                    </td>
                                    {/* <td className="p-3">{item.color ?? "-"}</td>
                                    <td className="p-3">{item.size ?? "-"}</td> */}
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
                    {/* DoorDash Tracking Info */}
                    {trackingUrl && (
                        <div className="bg-white border-2 border-primary rounded-md p-4 shadow-md animate-pulse-slow">
                            <h3 className="text-primary text-lg font-bold mb-3 flex items-center gap-2">
                                <RiTruckFill /> Live Delivery Tracking
                            </h3>
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">
                                    Your order is being delivered by DoorDash. Click below to track your driver in real-time.
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
                        <p><strong>Status:</strong> {status?.charAt(0).toUpperCase() + status.slice(1)}</p>
                        <p><strong>Shipping Fee:</strong> ${shipping.toFixed(2)}</p>
                        <p><strong>Order Date:</strong> {new Date(createdAt).toDateString()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderPage;
