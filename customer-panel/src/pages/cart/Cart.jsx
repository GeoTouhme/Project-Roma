import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import Breadcrumb from "../../components/breadcrumb";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { removeFromCart, updateQuantity } from "../../redux/cartSlice";

const Cart = () => {
  const navigate = useNavigate();
  // Dummy cart data
  const cartItems = useSelector((state) => state.cart.cartItems);
  const dispatch = useDispatch();

  // Handle quantity change
  const handleQuantityChange = (id, newQuantity) => {
    dispatch(updateQuantity({ id, quantity: newQuantity }));
  };

  // Handle remove item
  const removeItem = (id) => {
    dispatch(removeFromCart(id));
  };

  // Calculate total price
  // Use item.price which is now normalized in reducer to be the effective selling price
  const subtotal = cartItems.reduce((total, item) => total + (item.priceSale || item.salePrice || item.price || 0) * item.quantity, 0);

  const handleBillingNavigate = () => {
    const isAuthenticated = JSON.parse(localStorage.getItem("isAuthenticated"));

    if (!isAuthenticated) {
      navigate("/login");
    } else {
      navigate("/billing");
    }
  };

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
                  {cartItems.length === 0 ?
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-gray-500">
                        No items found.
                      </td>
                    </tr> : cartItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-4 flex items-center space-x-4">
                          <button onClick={() => removeItem(item.id)} className="text-red-500">
                            <FaTimes size={16} />
                          </button>
                          <img src={item.image} alt={item.name} className="w-12 h-12" />
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
                    ))}
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
            <div className="flex justify-between text-gray-700">
              <p>Subtotal:</p>
              <p>${subtotal?.toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-gray-700 my-2">
              <p>Shipping:</p>
              <p>Free</p>
            </div>
            <div className="flex justify-between text-lg font-semibold mt-2">
              <p>Total:</p>
              <p>${subtotal?.toFixed(2)}</p>
            </div>
            <button
              className="w-full mt-6 bg-[#B5223B] text-white py-3 rounded-lg hover:bg-red-700"
              onClick={() => handleBillingNavigate()}
            >
              Proceed to checkout
            </button>
          </div>}
        </div>
      </div >
    </>
  );
};

export default Cart;
