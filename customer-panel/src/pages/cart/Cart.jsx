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
    markup: 0,
    total: 0,
  });
  const [summaryError, setSummaryError] = useState(false);

  // Fetch estimated tax and markup from the server whenever the cart changes.
  useEffect(() => {
    const loadSummary = async () => {
      if (cartItems.length === 0) {
        setSummary({ subtotal: 0, tax: 0, markup: 0, total: 0 });
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
          setSummary({ subtotal: localSubtotal, tax: 0, markup: 0, total: localSubtotal });
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
        setSummary({ subtotal: localSubtotal, tax: 0, markup: 0, total: localSubtotal });
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

      <div className="container pb-[120px] md:pb-[100px]">
        {cartItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-lg mb-6">Your cart is empty.</p>
            <button
              className="bg-[#B5223B] text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
              onClick={() => navigate("/products")}
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => {
                const isBundle = item.type === "bundle";
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                  >
                    <div className="flex gap-4">
                      <img
                        src={getThumbnailImage(item.image)}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                            {isBundle && (
                              <p className="text-xs text-gray-500 mt-1">
                                Bundle of{" "}
                                {item.dealQuantity || item.products?.length || item.quantity} items
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 p-2 -mr-2 -mt-2 flex-shrink-0"
                            aria-label="Remove item"
                          >
                            <FaTimes size={18} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center border border-gray-200 rounded-lg">
                            <button
                              onClick={() => handleQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                              className="px-3 py-2 text-[#B5223B] font-bold min-w-[44px] min-h-[44px]"
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="px-3 font-semibold min-w-[32px] text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="px-3 py-2 text-[#B5223B] font-bold min-w-[44px] min-h-[44px]"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          <p className="font-bold text-primary text-lg">
                            ${
                              isBundle
                                ? (Number(item.bundlePrice) * item.quantity).toFixed(2)
                                : ((item.priceSale || item.salePrice || item.price || 0) * item.quantity).toFixed(2)
                            }
                          </p>
                        </div>

                        {isBundle && item.products?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                            {item.products.map((sub) => (
                              <div
                                key={`${item.id}-${sub.id}`}
                                className="flex items-center gap-3 text-sm text-gray-600"
                              >
                                <img
                                  src={getThumbnailImage(sub.image)}
                                  alt={sub.name}
                                  className="w-8 h-8 rounded object-cover"
                                  loading="lazy"
                                />
                                <span className="flex-1 truncate">{sub.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="hidden md:block">
                <button
                  className="border px-5 py-3 rounded-md bg-gray-800 text-white font-medium"
                  onClick={() => navigate("/products")}
                >
                  Return To Shop
                </button>
              </div>
            </div>

            {/* Order Summary - desktop sidebar */}
            <div className="hidden lg:block">
              <div className="bg-gray-100 p-6 rounded-xl shadow-md sticky top-24">
                <h2 className="text-xl font-semibold mb-4">Cart Total</h2>
                {summaryError && (
                  <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded mb-4">
                    Tax and markup could not be estimated right now. The total will be recalculated at checkout.
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
                  <p>Markup (2%):</p>
                  <p>${(summary.markup || 0).toFixed(2)}</p>
                </div>
                <div className="flex justify-between text-lg font-semibold mt-2 pt-2 border-t border-gray-300">
                  <p>Total:</p>
                  <p>${(summary.total || subtotal)?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {cartItems.length > 0 && (
          <RecommendationSection
            title="You May Also Like"
            slugs={cartItems.map((item) => item.slug).filter(Boolean)}
            productIds={cartItems.map((item) => item.id).filter(Boolean)}
            limit={4}
          />
        )}

        {/* Fixed mobile checkout bar */}
        {cartItems.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:hidden z-[70]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-bold text-[#B5223B]">${(summary.total || subtotal)?.toFixed(2)}</p>
              </div>
              <button
                className="flex-1 bg-[#B5223B] text-white py-3.5 rounded-lg font-bold uppercase tracking-wide hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                onClick={() => handleBillingNavigate()}
                disabled={!storeIsOpen}
              >
                {!storeIsOpen ? "Store is Closed" : "Proceed to checkout"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Cart;
