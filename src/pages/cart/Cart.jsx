import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import Breadcrumb from "../../components/breadcrumb";
import { useNavigate } from "react-router-dom";
import Product from "../../assets/images/product.png";

const Cart = () => {
  const navigate = useNavigate();
  // Dummy cart data
  const [cartItems, setCartItems] = useState([
    {
      id: 1,
      name: "Johnnie Walker Blue Label Scotch Whisky 1.75L",
      price: 650,
      quantity: 1,
      image: Product, // Replace with actual image
    },
  ]);

  // Handle quantity change
  const handleQuantityChange = (id, newQuantity) => {
    setCartItems((prevCart) => prevCart.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)));
  };

  // Handle remove item
  const removeItem = (id) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  // Calculate total price
  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  {cartItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-4 flex items-center space-x-4">
                        <button onClick={() => removeItem(item.id)} className="text-red-500">
                          <FaTimes size={16} />
                        </button>
                        <img src={item.image} alt={item.name} className="w-12 h-12" />
                        <p>{item.name}</p>
                      </td>
                      <td className="p-4">${item.price}</td>
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
                      <td className="p-4">${item.price * item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Buttons */}
            <div className="flex justify-between mt-4">
              <button className="border px-4 py-2 rounded-md text-gray-700">Return To Shop</button>
              <button className="border px-4 py-2 rounded-md bg-gray-800 text-white">Update Cart</button>
            </div>
          </div>

          {/* Cart Summary */}
          <div className="bg-gray-100 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Cart Total</h2>
            <div className="flex justify-between text-gray-700">
              <p>Subtotal:</p>
              <p>${subtotal}</p>
            </div>
            <div className="flex justify-between text-gray-700 my-2">
              <p>Shipping:</p>
              <p>Free</p>
            </div>
            <div className="flex justify-between text-lg font-semibold mt-2">
              <p>Total:</p>
              <p>${subtotal}</p>
            </div>
            <button
              className="w-full mt-6 bg-[#B5223B] text-white py-3 rounded-lg hover:bg-red-700"
              onClick={() => navigate("/billing")}
            >
              Proceed to checkout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Cart;
