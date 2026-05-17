import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye } from "react-icons/fa";
import OrderService from "../../services/orderService";
import { getThumbnailImage } from "../../utils/cloudinary";
import moment from "moment";
import Breadcrumb from "../../components/breadcrumb";

const OrdersPage = () => {
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await OrderService.getAllOrders({ page, limit });
            if (response?.success) {
                setOrders(response.data);
                setTotalCount(response.count);
            }
        } catch (error) {
            console.error("Fetch Orders Failed:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [page, limit]);

    const totalPages = Math.ceil(totalCount / limit);

    return (
        <div className="p-6 container">
            <div className="main">
                <div className="page-title text-center mx-auto py-10">
                    <h2 className="text-[30px] font-bold mb-2">Orders</h2>
                    <div className="breadcrumbs">
                        <Breadcrumb />
                    </div>
                </div>
            </div>

            {/* Limit Selection */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="rowsPerPage" className="text-sm text-gray-700">
                        Rows per page:
                    </label>
                    <select
                        id="rowsPerPage"
                        value={limit}
                        onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
                        className="border rounded px-2 py-1 text-sm"
                    >
                        {[5, 10, 25, 100].map((num) => (
                            <option key={num} value={num}>
                                {num}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto shadow rounded bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-primary text-white">
                        <tr className="text-left text-sm font-medium">
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Items</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-6">
                                    <span className="text-gray-500">Loading orders...</span>
                                </td>
                            </tr>
                        ) : orders.length > 0 ? (
                            orders.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 flex items-center gap-3">
                                        <img
                                            src={getThumbnailImage(order.items[0]?.imageUrl)}
                                            alt={order.items[0]?.name}
                                            className="w-10 h-10 object-cover rounded"
                                            loading="lazy"
                                        />
                                        <span>{order.items[0]?.name}</span>
                                    </td>
                                    <td className="px-4 py-3">{order.totalItems}</td>
                                    <td className="px-4 py-3">${order.total.toFixed(2)}</td>
                                    <td className="px-4 py-3 capitalize">{order.status}</td>
                                    <td className="px-4 py-3">
                                        {moment(order.createdAt).format("MMM DD, YYYY")}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => navigate(`/order/${order._id}`)}
                                            className="text-primary hover:text-blue-700 transition"
                                            title="View Order"
                                        >
                                            <FaEye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="text-center py-6 text-gray-500">
                                    No orders found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4 text-sm">
                <button
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    className={`px-4 py-2 rounded ${page === 1
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-blue-600"
                        }`}
                >
                    Prev
                </button>
                <span>
                    Showing {(page - 1) * limit + 1} -{" "}
                    {Math.min(page * limit, totalCount)} of {totalCount}
                </span>
                <button
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page === totalPages}
                    className={`px-4 py-2 rounded ${page === totalPages
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-blue-600"
                        }`}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default OrdersPage;
