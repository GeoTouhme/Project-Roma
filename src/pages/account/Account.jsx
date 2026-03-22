import React, { useState } from "react";
import Header from "../../components/header";
import Footer from "../../components/footer";
import { BiSolidPencil } from "react-icons/bi";
import Breadcrumb from "../../components/breadcrumb";
import { LuUser, LuTable2 } from "react-icons/lu";
import { IoMdHeartEmpty } from "react-icons/io";
import { SlLogout } from "react-icons/sl";
import Product from "../../assets/images/product.png";
import ProductCard from "../../components/product-card";
import ProductImage1 from "../../assets/images/product-img-1.png";
import ProductImage2 from "../../assets/images/product-img-2.png";
import ProductImage3 from "../../assets/images/product-img-3.png";
import ProductImage4 from "../../assets/images/product-img-4.png";
import ProductImage5 from "../../assets/images/product-img-5.png";
import ProductImage6 from "../../assets/images/product-img-6.png";
import ProductImage7 from "../../assets/images/product-img-7.png";
import ProductImage8 from "../../assets/images/product-img-8.png";

const Account = () => {
  const [activeTab, setActiveTab] = useState("myInfo");
  const [ordersTab, setOrdersTab] = useState("active");
  const [editMode, setEditMode] = useState(false);

  const [userInfo, setUserInfo] = useState({
    name: "Sardor",
    phone: "+1 (123) 456-7890",
    email: "sardor@example.com",
  });

  const [passwordInfo, setPasswordInfo] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const orders = {
    active: [
      {
        id: 1,
        product: "MSI RTX 4070 TI Super Ventus 3X OC 16GB Gaming Graphics Card",
        quantity: 1,
        date: "11/9/2023",
        total: "$49.99",
        status: "Processing",
      },
      {
        id: 1,
        product: "MSI RTX 4070 TI Super Ventus 3X OC 16GB Gaming Graphics Card",
        quantity: 1,
        date: "11/9/2023",
        total: "$49.99",
        status: "Processing",
      },
    ],
    cancelled: [],
    completed: [],
  };

  const CategoryProducts = [
    {
      id: 1,
      title: "Elegant Bordeaux Blend Reserve Precious Rose",
      volume: "800 ML",
      price: 49.99,
      image: ProductImage1,
      rating: 4.5,
      isWishlisted: true,
    },
    {
      id: 2,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage2,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 3,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage3,
      rating: 4,
      isWishlisted: true,
    },
    {
      id: 4,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage4,
      rating: 3.5,
      isWishlisted: true,
    },
    {
      id: 5,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "600 ML",
      price: 49.99,
      image: ProductImage5,
      rating: 4.5,
      isWishlisted: true,
    },
    {
      id: 6,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage6,
      rating: 4,
      isWishlisted: true,
    },
    {
      id: 7,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage7,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 48,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1200 ML",
      price: 49.99,
      image: ProductImage8,
      rating: 4,
      isWishlisted: true,
    },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    setEditMode(false);
    // Here you would typically send the updated info to your backend
  };

  return (
    <>
      <div className="main">
        <div className="page-title text-center mx-auto py-10">
          <h2 className="text-[30px] font-bold mb-2">Account</h2>
          <div className="breadcrumbs">
            <Breadcrumb />
          </div>
        </div>
      </div>

      <div className="main">
        <div className="container mx-auto px-4">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Hello, {userInfo.name}</h1>
            <p className="text-gray-600">Welcome to your Account</p>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-1/4">
              <div className="w-full">
                <ul className="space-y-2 md:space-y-3 flex flex-col py-4 md:py-6 w-full">
                  <li className="w-full">
                    <button
                      className={`w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded ${
                        activeTab === "myInfo"
                          ? "bg-[#B5223B] text-white text-lg md:text-xl font-semibold"
                          : "hover:bg-gray-50 text-lg md:text-xl text-black"
                      }`}
                      onClick={() => setActiveTab("myInfo")}
                    >
                      <LuUser className="text-xl md:text-2xl" />
                      <span>My Info</span>
                    </button>
                  </li>
                  <li className="w-full">
                    <button
                      className={`w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded ${
                        activeTab === "myOrders"
                          ? "bg-[#B5223B] text-white text-lg md:text-xl font-semibold"
                          : "hover:bg-gray-50 text-lg md:text-xl text-black"
                      }`}
                      onClick={() => setActiveTab("myOrders")}
                    >
                      <LuTable2 className="text-xl md:text-2xl" />
                      <span>My Orders</span>
                    </button>
                  </li>
                  <li className="w-full">
                    <button
                      className={`w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded ${
                        activeTab === "wishlist"
                          ? "bg-[#B5223B] text-white text-lg md:text-xl font-semibold"
                          : "hover:bg-gray-50 text-lg md:text-xl text-black"
                      }`}
                      onClick={() => setActiveTab("wishlist")}
                    >
                      <IoMdHeartEmpty className="text-xl md:text-2xl" />
                      <span>Wishlist</span>
                    </button>
                  </li>
                  <li className="w-full">
                    <button className="w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded hover:bg-gray-50 text-[#B5223B] text-lg md:text-xl font-semibold">
                      <SlLogout className="text-xl md:text-2xl" />
                      <span>Sign Out</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {/* Main Content */}
            <div className="w-full md:w-3/4">
              {activeTab === "myInfo" && (
                <div className="p-6 mb-24">
                  <div className="space-y-6">
                    <div>
                      <div className="grid gap-4">
                        {/* Name as a full-width row */}
                        <div className="md:col-span-2">
                          <label className="block text-gray-700 mb-1 text-sm font-normal">Name</label>
                          {editMode ? (
                            <input
                              type="text"
                              name="name"
                              value={userInfo.name}
                              onChange={handleInputChange}
                              className="w-full p-2 border border-gray-300 rounded"
                            />
                          ) : (
                            <p className="p-2 bg-gray-50 rounded">{userInfo.name}</p>
                          )}
                        </div>

                        {/* Phone Number and Email side by side */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-700 mb-1 text-sm font-normal">Phone Number</label>
                            {editMode ? (
                              <input
                                type="tel"
                                name="phone"
                                value={userInfo.phone}
                                onChange={handleInputChange}
                                className="w-full h-11 p-2 border border-gray-300 rounded"
                              />
                            ) : (
                              <p className="p-2 bg-gray-50 rounded">{userInfo.phone}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-1 text-sm font-normal">Email</label>
                            {editMode ? (
                              <input
                                type="email"
                                name="email"
                                value={userInfo.email}
                                onChange={handleInputChange}
                                className="w-full h-11 p-2 border border-gray-300 rounded"
                              />
                            ) : (
                              <p className="p-2 bg-gray-50 rounded">{userInfo.email}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <h3 className="text-2xl font-medium mb-4">Change Password</h3>
                      <div className="grid gap-4">
                        <div className="w-full">
                          <label className="block text-gray-700 mb-1 text-sm font-normal">Old Password</label>
                          <input
                            type="password"
                            name="oldPassword"
                            value={passwordInfo.oldPassword}
                            onChange={handlePasswordChange}
                            className="w-full h-11 p-2 border border-gray-300 rounded"
                          />
                        </div>
                        <div className="w-full">
                          <label className="block text-gray-700 mb-1 text-sm font-normal">New Password</label>
                          <input
                            type="password"
                            name="newPassword"
                            value={passwordInfo.newPassword}
                            onChange={handlePasswordChange}
                            className="w-full h-11 p-2 border border-gray-300 rounded"
                          />
                        </div>
                        <div className="w-full">
                          <label className="block text-gray-700 mb-1 text-sm font-normal">Confirm New Password</label>
                          <input
                            type="password"
                            name="confirmPassword"
                            value={passwordInfo.confirmPassword}
                            onChange={handlePasswordChange}
                            className="w-full h-11 p-2 border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "myOrders" && (
                <div className="p-6 mb-24">
                  <h3 className="text-4xl font-medium mb-4">Order Details</h3>
                  {/* <div className="">
                    <div className="flex">
                      <button
                        className={`px-6 py-3 text-2xl text-center flex-1 ${
                          ordersTab === "active"
                            ? "border-b-4 border-[#B5223B] text-[#B5223B] font-semibold"
                            : "text-gray-600"
                        }`}
                        onClick={() => setOrdersTab("active")}
                      >
                        Active
                      </button>
                      <button
                        className={`px-6 py-3 text-2xl text-center flex-1 ${
                          ordersTab === "cancelled"
                            ? "border-b-4 border-[#B5223B] text-[#B5223B] font-semibold"
                            : "text-gray-600"
                        }`}
                        onClick={() => setOrdersTab("cancelled")}
                      >
                        Cancelled
                      </button>
                      <button
                        className={`px-6 py-3 text-2xl text-center flex-1 ${
                          ordersTab === "completed"
                            ? "border-b-4 border-[#B5223B] text-[#B5223B] font-semibold"
                            : "text-gray-600"
                        }`}
                        onClick={() => setOrdersTab("completed")}
                      >
                        Completed
                      </button>
                    </div>
                  </div> */}

                  <div className="overflow-x-auto">
                    <div className="flex w-max md:w-full">
                      <button
                        className={`px-6 py-3 text-lg md:text-2xl text-center flex-1 ${
                          ordersTab === "active"
                            ? "border-b-4 border-[#B5223B] text-[#B5223B] font-semibold"
                            : "text-gray-600"
                        }`}
                        onClick={() => setOrdersTab("active")}
                      >
                        Active
                      </button>
                      <button
                        className={`px-6 py-3 text-lg md:text-2xl text-center flex-1 ${
                          ordersTab === "cancelled"
                            ? "border-b-4 border-[#B5223B] text-[#B5223B] font-semibold"
                            : "text-gray-600"
                        }`}
                        onClick={() => setOrdersTab("cancelled")}
                      >
                        Cancelled
                      </button>
                      <button
                        className={`px-6 py-3 text-lg md:text-2xl text-center flex-1 ${
                          ordersTab === "completed"
                            ? "border-b-4 border-[#B5223B] text-[#B5223B] font-semibold"
                            : "text-gray-600"
                        }`}
                        onClick={() => setOrdersTab("completed")}
                      >
                        Completed
                      </button>
                    </div>
                  </div>

                  <div className="py-4">
                    {orders[ordersTab].length > 0 ? (
                      orders[ordersTab].map((order) => (
                        // <div key={order.id} className="px-5 py-4 border-b-2 border-[#d1b1b7]">
                        //   <div className="flex justify-between items-center">
                        //     {/* Product Image and Info */}
                        //     <div className="flex items-start gap-4">
                        //       <div>
                        //         <img src={Product} alt="product img" />
                        //       </div>
                        //       <div>
                        //         <h3 className="font-medium">{order.product}</h3>
                        //         <p className="text-gray-600 mt-1">Qty: {order.quantity}</p>
                        //         <p className="text-gray-600 mt-1">Total: {order.total}</p>
                        //       </div>
                        //     </div>

                        //     {/* Button on the rightmost side */}
                        //     <button className="h-14 px-20 bg-[#B5223B] text-base text-[#D9D9D9] rounded-md font-medium hover:bg-[#B5223B] hover:text-white transition">
                        //       View Details
                        //     </button>
                        //   </div>
                        // </div>

                        <div key={order.id} className="px-5 py-4 border-b-2 border-[#d1b1b7]">
                          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                            {/* Product Image */}
                            <div className="w-full md:w-auto flex justify-center">
                              <img src={Product} alt="product img" className="w-24 h-24 object-cover" />
                            </div>

                            {/* Product Info */}
                            <div className="text-center md:text-left">
                              <h3 className="font-medium">{order.product}</h3>
                              <p className="text-gray-600 mt-1">Qty: {order.quantity}</p>
                              <p className="text-gray-600 mt-1">Total: {order.total}</p>
                            </div>

                            {/* Button */}
                            <div className="w-full md:w-auto flex justify-center">
                              <button className="h-12 px-16 md:h-14 md:px-20 bg-[#B5223B] text-sm md:text-base text-[#D9D9D9] rounded-md font-medium hover:bg-[#B5223B] hover:text-white transition">
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No {ordersTab} orders found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "wishlist" && (
                <div className="p-2 md:p-6 mb-24">
                  <div className="collection_grid">
                    <div className="products_list grid grid-cols-2 md:grid-cols-3 md:gap-5 gap-2">
                      {CategoryProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Account;
