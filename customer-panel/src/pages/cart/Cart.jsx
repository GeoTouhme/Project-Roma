import { sellingPrice } from "../../utils/salePricing";
import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import Breadcrumb from "../../components/breadcrumb";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getThumbnailImage } from "../../utils/cloudinary";
import { removeFromCart, updateQuantity, applyPriceRefresh } from "../../redux/cartSlice";
import { refreshCartProducts } from "../../utils/cartRepricing";
import RecommendationSection from "../../components/recommendation-section";
import OrderService from "../../services/orderService";
import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from "../../config/orderingConfig";
import { safeJSONParse } from "../../utils/safeStorage";

const Cart = () => {
  const navigate = useNavigate();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const { isOpen: storeIsOpen } = useSelector((state) => state.storeStatus);
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [quote, setQuote] = useState(null);
  const [retry, setRetry] = useState(0);
  // Never trust a persisted verification flag. Each mount obtains fresh data.
  // Anonymous quantity changes reuse this mount's current product data.
  const requestItems = cartItems.map(item => ({
    pid: item.id, type: item.type,
    ...(isAuthenticated ? { quantity: item.quantity, products: item.products?.map(p => ({ pid: p.id || p._id, quantity: p.quantity || 1 })) } : {}),
  }));
  const requestKey = JSON.stringify([isAuthenticated, requestItems, retry]);
  useEffect(() => {
    let active = true;
    if (!cartItems.length) return;
    const load = async () => {
      try {
        if (isAuthenticated) {
          const response = await OrderService.getCartSummary({ items: requestItems });
          if (!response?.success || !response.data) throw new Error('Summary unavailable');
          if (active) setQuote({ key: requestKey, summary: response.data });
        } else {
          const products = await refreshCartProducts(cartItems);
          if (!active) return;
          // Missing products have no new descriptive metadata: keep the saved
          // name/image/slug so the customer can identify and remove the line.
          dispatch(applyPriceRefresh(products.filter(product =>
            cartItems.some(item => item.type !== 'bundle' && item.id === product.id)
          ).map(product => {
            if (product.pricingStatus === 'ready') return product;
            const { name, image, slug, ...pricing } = product;
            return pricing;
          })));
          setQuote({ key: requestKey, products });
        }
      } catch {
        if (active) setQuote({ key: requestKey, failed: true });
      }
    };
    load();
    return () => { active = false; };
    // The key deliberately excludes refreshed metadata and anonymous quantities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, dispatch]);

  const loading = quote?.key !== requestKey;
  const summary = !loading && !quote?.failed ? quote?.summary : null;
  const unitPriceOf = (item) => {
    if (loading || quote?.failed) return null;
    if (isAuthenticated) {
      const value = summary?.items?.find(s => String(s.pid) === String(item.id))?.unitPrice;
      return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
    }
    if (item.type === 'bundle') return null; // Requires an authenticated deal quote.
    const product = quote?.products?.find(p => String(p.id) === String(item.id));
    return product?.pricingStatus === 'ready' ? sellingPrice(product) : null;
  };
  const validLine = item => unitPriceOf(item) !== null && Number.isInteger(item.quantity) && item.quantity > 0;
  const pricesReady = !loading && !quote?.failed && cartItems.every(validLine);
  const subtotal = pricesReady ? (summary?.subtotal ?? cartItems.reduce((sum, item) => sum + unitPriceOf(item) * item.quantity, 0)) : null;
  const displayAmount = value => loading ? 'Updating prices…' : value === null || !Number.isFinite(value) ? 'Price unavailable' : `$${value.toFixed(2)}`;
  const total = pricesReady ? (summary?.total ?? subtotal) : null;
  const summaryError = !loading && !pricesReady;

  // Refresh at a sale boundary rather than leaving a now-expired quote visible.
  useEffect(() => {
    const ends = (quote?.products || cartItems).map(p => new Date(p.saleEndsAt).getTime()).filter(t => t > Date.now());
    if (!ends.length) return;
    const timer = setTimeout(() => setRetry(n => n + 1), Math.min(Math.min(...ends) - Date.now() + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [quote, cartItems]);

  // Handle quantity change
  const handleQuantityChange = (id, newQuantity) => {
    dispatch(updateQuantity({ id, quantity: newQuantity }));
  };

  // Handle remove item
  const removeItem = (id) => {
    dispatch(removeFromCart(id));
  };

  const handleBillingNavigate = () => {
    if (!pricesReady) return;
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
        {cartItems.length > 0 && (
          <div aria-live="polite" className="mb-4 text-sm text-gray-700">
            {loading ? 'Updating prices…' : summaryError ? (
              <><p>Price unavailable. Your items have been kept. Retry prices or remove unavailable items to continue.</p>
                <button className="underline font-semibold py-3" onClick={() => setRetry(n => n + 1)}>Retry prices</button></>
            ) : !isAuthenticated ? 'Current product subtotal. Tax, markup, shipping and bundle discounts are calculated at checkout.' : null}
            {!isAuthenticated && cartItems.some(item => item.type === 'bundle') && (
              <p>Bundle prices require sign-in. <button className="underline py-3" onClick={() => navigate('/login')}>Sign in to verify bundle prices</button></p>
            )}
          </div>
        )}
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
                    key={`${item.type || 'product'}-${item.id}`}
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
                            {displayAmount(validLine(item) ? unitPriceOf(item) * item.quantity : null)}
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
                    Prices could not be verified. Checkout is paused until all items have valid prices.
                  </p>
                )}
                <div className="flex justify-between text-gray-700">
                  <p>Subtotal:</p>
                  <p>{displayAmount(subtotal)}</p>
                </div>
                <div className="flex justify-between text-gray-700 my-2">
                  <p>Shipping:</p>
                  <p>Calculated at checkout</p>
                </div>
                <div className="flex justify-between text-gray-700 my-2">
                  <p>Tax:</p>
                  <p>{summary && pricesReady ? displayAmount(summary.tax) : 'Calculated at checkout'}</p>
                </div>
                <div className="flex justify-between text-gray-700 my-2">
                  <p>Markup:</p>
                  <p>{summary && pricesReady ? displayAmount(summary.markup) : 'Calculated at checkout'}</p>
                </div>
                <div className="flex justify-between text-lg font-semibold mt-2 pt-2 border-t border-gray-300">
                  <p>{isAuthenticated ? 'Total:' : 'Estimated subtotal:'}</p>
                  <p>{displayAmount(total)}</p>
                </div>

                <button
                  className="w-full mt-6 bg-[#B5223B] text-white py-3.5 rounded-lg font-bold uppercase tracking-wide hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={() => handleBillingNavigate()}
                  disabled={!storeIsOpen || !pricesReady}
                >
                  {!storeIsOpen ? "Store is Closed" : "Proceed to checkout"}
                </button>
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
                <p className="text-xs text-gray-500">{isAuthenticated ? 'Total' : 'Estimated subtotal'}</p>
                <p className="text-xl font-bold text-[#B5223B]">{displayAmount(total)}</p>
              </div>
              <button
                className="flex-1 bg-[#B5223B] text-white py-3.5 rounded-lg font-bold uppercase tracking-wide hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                onClick={() => handleBillingNavigate()}
                disabled={!storeIsOpen || !pricesReady}
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
