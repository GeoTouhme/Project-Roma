import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import Breadcrumb from "../../components/breadcrumb";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getThumbnailImage } from "../../utils/cloudinary";
import { removeFromCart, updateQuantity } from "../../redux/cartSlice";
import RecommendationSection from "../../components/recommendation-section";
import OrderService from "../../services/orderService";
import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from "../../config/orderingConfig";
import { safeJSONParse } from "../../utils/safeStorage";

const Cart = () => {
  const navigate = useNavigate();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const { isOpen: storeIsOpen } = useSelector((state) => state.storeStatus);
  const dispatch = useDispatch();

  const [summary, setSummary] = useState({
    subtotal: 0,
    tax: 0,
    crv: 0,
    total: 0,
  });
  const [summaryError, setSummaryError] = useState(false);

  // Fetch estimated tax and CRV from the server whenever the cart changes.
  useEffect(() => {
    const loadSummary = async () => {
      if (cartItems.length === 0) {
        setSummary({ subtotal: 0, tax: 0, crv: 0, total: 0 });
        return;
      }

      try {
        setSummaryError(false);
        const items = cartItems.map((item) => {
          if (item.type === "bundle") {
            return {
              pid: item.id,
              quantity: item.quantity,
              type: "bundle",
              bundlePrice: Number(item.bundlePrice),
              products: (item.products || []).map((p) => ({
                pid: p.id || p._id,
                quantity: p.quantity || 1,
              })),
            };
          }
          return { pid: item.id, quantity: item.quantity };
        });
        const response = await OrderService.getCartSummary({ items });
        if (response?.success && response.data) {
          setSummary(response.data);
        } else {
          setSummaryError(true);
          // Fallback to local subtotal only if server summary fails.
          const localSubtotal = cartItems.reduce(
            (total, item) =>
              total +
              (item.priceSale || item.salePrice || item.price || 0) *
                item.quantity,
            0
          );
          setSummary({ subtotal: localSubtotal, tax: 0, crv: 0, total: localSubtotal });
        }
      } catch (error) {
        console.error("Failed to load cart summary:", error);
        setSummaryError(true);
        const localSubtotal = cartItems.reduce(
          (total, item) =>
            total +
            (item.priceSale || item.salePrice || item.price || 0) *
              item.quantity,
          0
        );
        setSummary({ subtotal: localSubtotal, tax: 0, crv: 0, total: localSubtotal });
      }
    };

    loadSummary();
  }, [cartItems]);

  // Handle quantity change
  const handleQuantityChange = (id, newQuantity) => {
    dispatch(updateQuantity({ id, quantity: newQuantity }));
  };

  // Handle remove item
  const removeItem = (id) => {
    dispatch(removeFromCart(id));
  };

  const subtotal = summary.subtotal ??
    cartItems.reduce((total, item) => {
      if (item.type === 'bundle') {
        return total + Number(item.bundlePrice || 0) * item.quantity;
      }
      return total + (item.priceSale || item.salePrice || item.price || 0) * item.quantity;
    }, 0);

  const handleBillingNavigate = () => {
    const isAuthenticated = safeJSONParse("isAuthenticated", false);

    if (!isAuthenticated) {
      navigate("/login");
    } else {
      navigate("/billing");
    }
  };

  if (ORDERING_DISABLED) {
    return (
      <div className="main">
        <div className="page-title text-center mx-auto py-10">
          <h2 className="text-[30px] font-bold mb-2">Cart</h2>
          <div className="breadcrumbs">
            <Breadcrumb />
          </div>
        </div>
        <div className="container py-20 text-center">
          <h2 className="text-2xl font-bold mb-4">Online Ordering Coming Soon!</h2>
          <p className="text-gray-600 mb-8">Order now through our DoorDash partner for fast delivery.</p>
          <a
            href={DOORDASH_ORDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#B5223B] text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-red-700 transition inline-block"
          >
            Order Now on DoorDash
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="main">
        <div className="page-title text-center mx-auto py-10">
          <h2 className="text-[30px] font-bold mb-2">Cart</h2>
          <div className="breadcrumbs">
            <Breadcrumb />
          </div>
        </div>
      </div>

      <div className="container md:pb-[100px] pb-[40px]">
        {/* Cart Table */}
        <div className={`grid ${cartItems.length > 0 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 "}  gap-8`}>
          <div className="md:col-span-2">
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="p-4">Product</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Quantity</th>
                    <th className="p-4">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-gray-500">
                        No items found.
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((item) =>
                      item.type === "bundle" ? (
                        <React.Fragment key={item.id}>
                          <tr className="border-t bg-gray-50">
                                  <td className="p-4 flex items-center space-x-4" colSpan={1}>
                                    <button onClick={() => removeItem(item.id)} className="text-red-500">
                                      <FaTimes size={16} />
                                    </button>
                                    <img
                                      src={getThumbnailImage(item.image)}
                                      alt={item.name}
                                      className="w-12 h-12"
                                      loading="lazy"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                                      <p className="text-xs text-gray-500">Bundle of {item.dealQuantity || item.products?.length || item.quantity} items</p>
                                    </div>
                                  </td>
                                  <td className="p-4">${Number(item.bundlePrice).toFixed(2)}</td>
                                  <td className="p-4">
                                    <select
                                      value={item.quantity}
                                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                                      className="border p-2"
                                    >
                                      {[1, 2, 3, 4, 5].map((q) => (
                                        <option key={q} value={q}>
                                          {q}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-4">${(Number(item.bundlePrice) * item.quantity).toFixed(2)}</td>
                                </tr>
                          {(item.products || []).map((sub) => (
                            <tr key={`${item.id}-${sub.id}`} className="border-t">
                              <td className="p-4 pl-12 flex items-center space-x-4" colSpan={1}>
                                <img
                                  src={getThumbnailImage(sub.image)}
                                  alt={sub.name}
                                  className="w-10 h-10"
                                  loading="lazy"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 truncate">{sub.name}</p>
                                </div>
                              </td>
                              <td className="p-4 text-sm text-gray-500" colSpan={3}>Included in bundle</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ) : (
                        <tr key={item.id} className="border-t">
                          <td className="p-4 flex items-center space-x-4">
                            <button onClick={() => removeItem(item.id)} className="text-red-500">
                              <FaTimes size={16} />
                            </button>
                            <img src={getThumbnailImage(item.image)} alt={item.name} className="w-12 h-12" loading="lazy" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{item.name}</p>
                            </div>
                          </td>
                          <td className="p-4">${item.priceSale || item.salePrice || item.price || 0}</td>
                          <td className="p-4">
                            <select
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                              className="border p-2"
                            >
                              {[1, 2, 3, 4, 5].map((q) => (
                                <option key={q} value={q}>
                                  {q}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4">${((item.priceSale || item.salePrice || item.price || 0) * item.quantity).toFixed(2)}</td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Buttons */}
            <div className="flex justify-end mt-4">
              <button className="border px-4 py-2 rounded-md  bg-gray-800 text-white" onClick={() => navigate("/products")}> Return To Shop</button>
              {/* <button className="border px-4 py-2 rounded-md bg-gray-800 text-white">Update Cart</button> */}
            </div>
          </div>

          {/* Cart Summary */}
          {cartItems.length > 0 && <div className="bg-gray-100 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Cart Total</h2>
            {summaryError && (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded mb-4">
                Tax and CRV could not be estimated right now. The total will be recalculated at checkout.
              </p>
            )}
            <div className="flex justify-between text-gray-700">
              <p>Subtotal:</p>
              <p>${subtotal?.toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-gray-700 my-2">
              <p>Shipping:</p>
              <p>Calculated at checkout</p>
            </div>
            <div className="flex justify-between text-gray-700 my-2">
              <p>Tax:</p>
              <p>${(summary.tax || 0).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-gray-700 my-2">
              <p>CRV:</p>
              <p>${(summary.crv || 0).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-lg font-semibold mt-2">
              <p>Total:</p>
              <p>${(summary.total || subtotal)?.toFixed(2)}</p>
            </div>
            <button
              className="w-full mt-6 bg-[#B5223B] text-white py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={() => handleBillingNavigate()}
              disabled={!storeIsOpen}
            >
              {!storeIsOpen ? "Store is Closed" : "Proceed to checkout"}
            </button>
          </div>}
        </div>

        {cartItems.length > 0 && (
          <RecommendationSection
            title="You May Also Like"
            slugs={cartItems.map((item) => item.slug).filter(Boolean)}
            productIds={cartItems.map((item) => item.id).filter(Boolean)}
            limit={4}
          />
        )}
      </div >
    </>
  );
};

export default Cart;
