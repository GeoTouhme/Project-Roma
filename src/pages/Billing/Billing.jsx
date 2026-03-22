import React from "react";
import Product from "../../assets/images/product.png";

const Billing = () => {
  return (
    <div className="container md:pb-[100px] pb-[40px]">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Section - Billing Details */}
        <div className="md:w-2/3 p-6 rounded-lg">
          <h2 className="text-3xl font-semibold mb-4">Billing Details</h2>

          <form>
            <div className="grid grid-cols-1 gap-4">
              {/* Name */}
              <div>
                <label className="block font-semibold">Name</label>
                <input type="text" placeholder="Enter your name" className="border rounded-lg h-11 p-3 w-full" />
              </div>

              {/* Address */}
              <div>
                <label className="block font-semibold">Address</label>
                <input type="text" placeholder="Enter your address" className="border rounded-lg h-11 p-3 w-full" />
              </div>

              {/* Country and City - Side by Side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold">Country</label>
                  <select className="border rounded-lg h-11 p-3 w-full">
                    <option>Select Country</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold">City</label>
                  <select className="border rounded-lg h-11 p-3 w-full">
                    <option>Select City</option>
                  </select>
                </div>
              </div>

              {/* Phone and Email - Side by Side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold">Phone Number</label>
                  <input
                    type="text"
                    placeholder="Enter your phone number"
                    className="border rounded-lg h-11 p-3 w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold">Email</label>
                  <input type="email" placeholder="Enter your email" className="border rounded-lg h-11 p-3 w-full" />
                </div>
              </div>

              {/* Zip Code */}
              <div>
                <label className="block font-semibold">Zip Code</label>
                <input type="text" placeholder="Enter zip code" className="border rounded-lg h-11 p-3 w-full" />
              </div>
            </div>

            {/* Saved Address */}
            <div className="mt-6 p-4 border border-[#CECECE] rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input type="radio" name="address" checked className="h-5 w-5 text-[#B5223B] accent-[#B5223B]" />
                <div>
                  <p className="font-semibold">Huzefa Bagwala</p>
                  <p className="text-gray-500">1131 Dusty Townline, Jacksonville, TX 40322</p>
                  <p>
                    <strong>Contact:</strong> (936) 361-0310
                  </p>
                </div>
              </div>
              <div className="flex text-sm text-[#B5223B]">
                <button className="mr-2">Edit</button> <p className="mx-4">|</p>{" "}
                <button className="ml-2">Remove</button>
              </div>
            </div>

            {/* Add New Address */}
            <button className="mt-4 text-[#B5223B] flex items-center">+ Add New Address</button>

            {/* Payment Methods */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Payment Method</h3>
              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <input type="radio" name="payment" className="h-5 w-5 text-[#B5223B] accent-[#B5223B]" checked />
                  <span className="font-semibold text-[#B5223B]">Cash On Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" name="payment" className="h-5 w-5" />
                  <span className="text-gray-500">PayPal</span>
                </div>
              </div>
            </div>

            {/* Place Order Button */}
            <button className="mt-6 bg-[#B5223B] text-white px-6 py-3 rounded-lg">Place Order</button>
          </form>
        </div>

        {/* Right Section - Order Summary */}
        <div className="md:w-1/3 p-6 rounded-lg">
          <div className="border border-[#CECECE] rounded-lg p-4">
            {/* Product */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <img src={Product} alt="Product" className="w-10 h-10" />
                <p className="text-gray-600">Johnnie Walker Blue Label Scotch Whisky 1.75L</p>
              </div>
              <p className="font-semibold">$650</p>
            </div>

            <hr />

            {/* Order Summary Details */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <p>Subtotal:</p>
                <p className="font-semibold">$1750</p>
              </div>
              <div className="flex justify-between">
                <p>Shipping:</p>
                <p className="font-semibold">Free</p>
              </div>
              <hr />
              <div className="flex justify-between font-semibold text-lg">
                <p>Total:</p>
                <p>$1750</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Billing;
