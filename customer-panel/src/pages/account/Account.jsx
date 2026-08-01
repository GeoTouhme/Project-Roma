import React, { useEffect, useState } from "react";
import Breadcrumb from "../../components/breadcrumb";
import { LuUser, LuTable2, LuShield } from "react-icons/lu";
import { IoMdHeartEmpty } from "react-icons/io";
import { SlLogout } from "react-icons/sl";
import ProductCard from "../../components/product-card";
import { logout } from "../../redux/authSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import UserService from "../../services/userService";
import AuthService from "../../services/authServices";
import WishlistService from "../../services/wishlistService";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import toast from "react-hot-toast";
import OrderService from "../../services/orderService";
import { getThumbnailImage } from "../../utils/cloudinary";
import { AiOutlineLoading3Quarters } from "react-icons/ai";


const Account = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("myInfo");
  const [editMode, setEditMode] = useState(false);
  const [userInfoLoading, setUserInfoLoading] = useState(true);
  const [userInfoSaving, setUserInfoSaving] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);


  const [userInfo, setUserInfo] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [user, setUser] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  const [passwordInfo, setPasswordInfo] = useState({
    password: "",
    newPassword: "",
    confirmPassword: "",
  });

  // 🛡️ MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupLoading, setMfaSetupLoading] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaManualKey, setMfaManualKey] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [disableMfaLoading, setDisableMfaLoading] = useState(false);
  // const [passwordInfoVisibility, setPasswordInfoVisibility] = useState({
  //   password: false,
  //   newPassword: false,
  //   confirmPassword: false,
  // });

  const [passwordInfoError, setPasswordInfoError] = useState({
    password: "",
    newPassword: "",
    confirmPassword: "",
  });

  // const orders = {
  //   active: [
  //     {
  //       id: 1,
  //       product: "MSI RTX 4070 TI Super Ventus 3X OC 16GB Gaming Graphics Card",
  //       quantity: 1,
  //       date: "11/9/2023",
  //       total: "$49.99",
  //       status: "Processing",
  //     },
  //     {
  //       id: 1,
  //       product: "MSI RTX 4070 TI Super Ventus 3X OC 16GB Gaming Graphics Card",
  //       quantity: 1,
  //       date: "11/9/2023",
  //       total: "$49.99",
  //       status: "Processing",
  //     },
  //   ],
  //   cancelled: [],
  //   completed: [],
  // };

  const fetchWishlistProducts = () => {
    setWishlistLoading(true)
    WishlistService.getWishlist()
      .then((response) => {
        if (response.success && Array.isArray(response.data)) {
          setWishlistProducts(response.data);
        } else {
          console.error("Invalid wishlist data:", response);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch products:", error);
      }).finally(() => {
        setWishlistLoading(false)
      });
  };

  useEffect(() => {
    if (activeTab === "wishlist") {
      fetchWishlistProducts();
    }
  }, [activeTab])

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
    setPasswordInfoError((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleOnEditClick = () => {
    setEditMode(true);
    // Here you would typically send the updated info to your backend
  };

  const validatePasswordInfo = () => {
    const newErrors = {};
    if (!passwordInfo.password) {
      newErrors.password = "Old password is required";
    }
    if (!passwordInfo.newPassword) {
      newErrors.newPassword = "New password is required";
    }
    if (!passwordInfo.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required";
    } else if (passwordInfo.confirmPassword !== passwordInfo.newPassword) {
      newErrors.confirmPassword = "Password does not match";
    }
    setPasswordInfoError(newErrors);
    console.log("newErrors=  ", newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleOnChangePassword = () => {
    if (!validatePasswordInfo()) {
      return;
    }
    console.log("passwordInfo = ", passwordInfo);

    setChangePasswordLoading(true);

    UserService.changePassword(passwordInfo)
      .then((response) => {
        if (response?.success) {
          toast.success(response?.message || "Success")
          setPasswordInfo({
            confirmPassword: "",
            newPassword: "",
            password: ""
          })
        }
      })
      .catch((error) => {
        console.log("error = ", error);

        toast.error(error?.message || "Failed")
      })
      .finally(() => {
        setChangePasswordLoading(false);
      })
  }

  const handleSaveUserDetails = () => {
    const passData = {
      firstName: userInfo?.firstName,
      lastName: userInfo?.lastName,
      phone: userInfo?.phone,
      email: userInfo?.email,
    }
    setUserInfoSaving(true)
    UserService.updateUser(passData)
      .then((response) => {
        console.log("response = ", response);
        if (response?.success) {
          toast.success(response?.message || "success");
          getUser();
          setEditMode(false)
        }
      })
      .catch((error) => {
        console.log("error = ", error);
        toast.error(error.message);
      })
      .finally(() => {
        setUserInfoSaving(false)
      })
  }

  const resetMfaSetup = () => {
    setShowMfaSetup(false);
    setMfaQrCode("");
    setMfaManualKey("");
    setMfaCode("");
  };

  const handleEnableMfa = () => {
    setMfaSetupLoading(true);
    setShowMfaSetup(true);
    AuthService.setupMfa()
      .then((response) => {
        if (response?.success) {
          setMfaQrCode(response?.qrCode || "");
          setMfaManualKey(response?.manualEntryKey || "");
        } else {
          toast.error(response?.message || "Failed to start MFA setup");
          resetMfaSetup();
        }
      })
      .catch((error) => {
        console.error("MFA setup error:", error);
        toast.error(error?.message || "Failed to start MFA setup");
        resetMfaSetup();
      })
      .finally(() => {
        setMfaSetupLoading(false);
      });
  };

  const handleConfirmMfa = () => {
    const code = mfaCode.replace(/\s/g, "");
    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    setMfaSetupLoading(true);
    AuthService.confirmMfa({ code })
      .then((response) => {
        if (response?.success) {
          toast.success("Two-factor authentication enabled successfully");
          setMfaEnabled(true);
          resetMfaSetup();
        } else {
          toast.error(response?.message || "Invalid MFA code");
        }
      })
      .catch((error) => {
        console.error("MFA confirm error:", error);
        toast.error(error?.message || "Failed to enable MFA");
      })
      .finally(() => {
        setMfaSetupLoading(false);
      });
  };

  const handleDisableMfa = () => {
    const code = mfaCode.replace(/\s/g, "");
    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    setDisableMfaLoading(true);
    AuthService.disableMfa({ code })
      .then((response) => {
        if (response?.success) {
          toast.success("Two-factor authentication disabled successfully");
          setMfaEnabled(false);
          resetMfaSetup();
        } else {
          toast.error(response?.message || "Invalid MFA code");
        }
      })
      .catch((error) => {
        console.error("MFA disable error:", error);
        toast.error(error?.message || "Failed to disable MFA");
      })
      .finally(() => {
        setDisableMfaLoading(false);
      });
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const getUser = async () => {
    setUserInfoLoading(true)
    UserService.getUser()
      .then((response) => {
        if (response?.success) {
          setUserInfo(response?.data)
          setUser(response?.data)
          setMfaEnabled(!!response?.data?.mfaEnabled)
        }
      })
      .catch((error) => {
        console.log("Error:", error);
      })
      .finally(() => {
        setUserInfoLoading(false);
      });
  };

  useEffect(() => {
    getUser();
  }, []);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await OrderService.getAllOrders({ page: 1, limit: 2 });
      if (response?.success) {
        setOrders(response.data);
        // setTotalCount(response.count);
      }
    } catch (error) {
      console.error("Fetch Orders Failed:", error);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "myOrders") {
      fetchOrders();
    }
  }, [activeTab])

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
            <h1 className="text-3xl font-bold">
              Hello, {userInfoLoading ? <Skeleton height={30} width={80} /> : user?.firstName + " " + user?.lastName}
            </h1>
            <p className="text-gray-600">Welcome to your Account</p>
          </div>

          {/* 🛡️ Soft reminder for Google sign-up users to add a phone number. */}
          {!userInfoLoading && !user?.phone && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm font-medium">
                ⚠️ Please add a phone number to your profile. A phone number is required at checkout.
              </p>
              <button
                onClick={() => setActiveTab("myInfo")}
                className="mt-2 text-sm text-[#B5223B] font-semibold hover:underline"
              >
                Go to My Info
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-1/4">
              <div className="w-full">
                <ul className="space-y-2 md:space-y-3 flex flex-col py-4 md:py-6 w-full">
                  <li className="w-full">
                    <button
                      className={`w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded ${activeTab === "myInfo"
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
                      className={`w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded ${activeTab === "myOrders"
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
                      className={`w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded ${activeTab === "wishlist"
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
                    <button
                      className="w-full flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded hover:bg-gray-50 text-[#B5223B] text-lg md:text-xl font-semibold"
                      onClick={handleLogout}
                    >
                      <SlLogout className="text-xl md:text-2xl" />
                      <span>Sign Out</span>
                    </button>
                  </li>
                </ul>

                <div className="hidden md:block mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <LuShield className={`text-xl ${mfaEnabled ? "text-green-600" : "text-gray-400"}`} />
                    <span className="font-semibold text-sm">Security</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {mfaEnabled
                      ? "Two-factor authentication is enabled."
                      : "Two-factor authentication is currently disabled."}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="w-full md:w-3/4">
              {activeTab === "myInfo" && (
                <div className="p-6 mb-24 w-full">
                  <div className="space-y-6 w-full">
                    <div className="w-full">
                      <h3 className="text-2xl font-medium mb-4">Account Details</h3>
                      <div className="flex md:flex-row flex-col items-center justify-between w-full gap-4">
                        <div className="w-full">
                          <label className="block text-gray-700 mb-1 text-sm font-normal">First Name</label>
                          {userInfoLoading ? <Skeleton height={40} /> :
                            editMode ? (
                              <input
                                type="text"
                                name="firstName"
                                value={userInfo?.firstName}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-300 rounded"
                              />
                            ) : (
                              <p className="p-2 bg-gray-50 rounded">
                                {userInfo?.firstName}
                              </p>
                            )}
                        </div>
                        <div className="w-full">
                          <label className="block text-gray-700 mb-1 text-sm font-normal">Last Name</label>
                          {userInfoLoading ? <Skeleton height={40} /> :
                            editMode ? (
                              <input
                                type="text"
                                name="lastName"
                                value={userInfo?.lastName}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-300 rounded"
                              />
                            ) : (
                              <p className="p-2 bg-gray-50 rounded">
                                {userInfo?.lastName}
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="flex md:flex-row flex-col items-end justify-between w-full mt-4">
                        {/* Phone Number and Email side by side */}
                        <div className="flex md:flex-row flex-col gap-4 items-center w-full">
                          <div className="md:w-[220px] w-full">
                            <label className="block text-gray-700 mb-1 text-sm font-normal">Phone Number</label>
                            {userInfoLoading ? <Skeleton height={40} /> : editMode ? (
                              <input
                                type="tel"
                                name="phone"
                                value={userInfo?.phone}
                                onChange={handleInputChange}
                                className="w-full h-11 p-2 border border-gray-300 rounded"
                              />
                            ) : (
                              <p className="p-2 bg-gray-50 rounded">{userInfo?.phone}</p>
                            )}
                          </div>
                          <div className="md:w-[420px] w-full">
                            <label className="block text-gray-700 mb-1 text-sm font-normal">Email</label>
                            {userInfoLoading ? <Skeleton height={40} /> : editMode ? (
                              <input
                                type="email"
                                name="email"
                                value={userInfo?.email}
                                onChange={handleInputChange}
                                className="w-full h-11 p-2 border border-gray-300 rounded"
                              />
                            ) : (
                              <p className="p-2 bg-gray-50 rounded">{userInfo?.email}</p>
                            )}
                          </div>
                        </div>
                        {editMode ? <button
                          onClick={handleSaveUserDetails}
                          className={`${userInfoSaving ? 'bg-[#B5223B]/80' : 'bg-[#B5223B] hover:bg-[#B5223B]'} md:mt-0 mt-4 text-white font-bold py-3 px-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out`}
                        > {userInfoSaving ? <div className="flex items-center">
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div> : "Save"}
                        </button> : <button
                          onClick={handleOnEditClick}
                          className="md:mt-0 mt-4 bg-[#B5223B] hover:bg-[#B5223B] text-white font-bold py-3 px-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                        > Edit
                        </button>}
                      </div>
                    </div>

                    {/* Change Password */}
                    <div className="pt-6">
                      <h3 className="text-2xl font-medium mb-4">Change Password</h3>
                      <div className="grid gap-4">
                        <div className="w-full">
                          <label className="block text-gray-700 mb-1 text-sm font-normal">Old Password</label>
                          <input
                            type="password"
                            name="password"
                            value={passwordInfo.password}
                            onChange={handlePasswordChange}
                            className="w-full h-11 p-2 border border-gray-300 rounded"
                          />
                          {passwordInfoError.password && <p className="text-red-500 text-sm">{passwordInfoError.password}</p>}
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
                          {passwordInfoError.newPassword && <p className="text-red-500 text-sm">{passwordInfoError.newPassword}</p>}
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
                          {passwordInfoError.confirmPassword && <p className="text-red-500 text-sm">{passwordInfoError.confirmPassword}</p>}
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={handleOnChangePassword}
                            className="bg-[#B5223B] hover:bg-[#B5223B] text-white font-bold py-3 px-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                          > {changePasswordLoading ? <div className="flex items-center">
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div> : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Two-Factor Authentication */}
                    <div className="pt-6 border-t border-gray-200">
                      <h3 className="text-2xl font-medium mb-4">Two-Factor Authentication</h3>

                      {!showMfaSetup && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <p className="text-gray-700">
                              Status:{" "}
                              <span className={mfaEnabled ? "text-green-600 font-semibold" : "text-gray-500 font-semibold"}>
                                {mfaEnabled ? "Enabled" : "Disabled"}
                              </span>
                            </p>
                            <p className="text-gray-500 text-sm mt-1">
                              {mfaEnabled
                                ? "Your account is protected with an authenticator app."
                                : "Add an extra layer of security with an authenticator app."}
                            </p>
                          </div>
                          <button
                            onClick={mfaEnabled ? () => setShowMfaSetup(true) : handleEnableMfa}
                            disabled={mfaSetupLoading || disableMfaLoading}
                            className={`bg-[#B5223B] hover:bg-[#9f1d32] text-white font-bold py-3 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed`}
                          >
                            {mfaSetupLoading || disableMfaLoading ? (
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : mfaEnabled ? (
                              "Disable MFA"
                            ) : (
                              "Enable MFA"
                            )}
                          </button>
                        </div>
                      )}

                      {showMfaSetup && !mfaEnabled && mfaQrCode && (
                        <div className="space-y-4">
                          <p className="text-gray-700">
                            Scan this QR code with your authenticator app, then enter the 6-digit code below to confirm.
                          </p>
                          <div className="flex justify-center">
                            <img src={mfaQrCode} alt="MFA QR Code" className="w-48 h-48" />
                          </div>
                          <div className="bg-gray-50 p-3 rounded text-center">
                            <p className="text-sm text-gray-600">Can’t scan? Enter this key manually:</p>
                            <p className="font-mono text-sm font-semibold break-all mt-1">{mfaManualKey}</p>
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-1 text-sm font-normal">6-digit code</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]{6}"
                              maxLength={6}
                              value={mfaCode}
                              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                              placeholder="123456"
                              className="w-full h-11 p-2 border border-gray-300 rounded text-center text-lg tracking-[0.5em]"
                            />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={handleConfirmMfa}
                              disabled={mfaSetupLoading || mfaCode.replace(/\s/g, "").length !== 6}
                              className="flex-1 bg-[#B5223B] hover:bg-[#9f1d32] text-white font-bold py-3 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {mfaSetupLoading ? (
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                              ) : (
                                "Confirm & Enable"
                              )}
                            </button>
                            <button
                              onClick={resetMfaSetup}
                              className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-md"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {showMfaSetup && mfaEnabled && (
                        <div className="space-y-4">
                          <p className="text-gray-700">
                            To disable two-factor authentication, enter a current 6-digit code from your authenticator app.
                          </p>
                          <div>
                            <label className="block text-gray-700 mb-1 text-sm font-normal">6-digit code</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]{6}"
                              maxLength={6}
                              value={mfaCode}
                              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                              placeholder="123456"
                              className="w-full h-11 p-2 border border-gray-300 rounded text-center text-lg tracking-[0.5em]"
                            />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={handleDisableMfa}
                              disabled={disableMfaLoading || mfaCode.replace(/\s/g, "").length !== 6}
                              className="flex-1 bg-[#B5223B] hover:bg-[#9f1d32] text-white font-bold py-3 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {disableMfaLoading ? (
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                              ) : (
                                "Disable MFA"
                              )}
                            </button>
                            <button
                              onClick={resetMfaSetup}
                              className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-md"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "myOrders" && (
                <div className="p-6 mb-24">
                  <h3 className="text-4xl font-medium mb-4">Order Details</h3>

                  <div className="py-4">
                    {ordersLoading ? (
                      <div className="flex justify-center items-center py-10">
                        <AiOutlineLoading3Quarters className="animate-spin text-3xl text-[#B5223B]" />
                      </div>
                    ) : orders.length > 0 ? (
                      orders.map((order) => (
                        <div key={order._id} className="px-5 py-4 border-b-2 border-[#d1b1b7]">
                          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                            {/* Product Image */}
                            <div className="w-full md:w-auto flex justify-center">
                              <img
                                src={getThumbnailImage(order.items?.[0]?.imageUrl)}
                                alt={order.items?.[0]?.name || "Product"}
                                className="w-24 h-24 object-cover rounded"
                                loading="lazy"
                              />
                            </div>

                            {/* Product Info */}
                            <div className="text-center md:text-left">
                              <h3 className="font-medium">{order.items?.[0]?.name}</h3>
                              <p className="text-gray-600 mt-1">Qty: {order.totalItems}</p>
                              <p className="text-gray-600 mt-1">Total: ${order.total}</p>
                            </div>

                            {/* Button */}
                            <div className="w-full md:w-auto flex justify-center">
                              <button
                                onClick={() => navigate(`/order/${order._id}`)}
                                className="h-12 px-16 md:h-14 md:px-20 bg-[#B5223B] text-sm md:text-base text-[#D9D9D9] rounded-md font-medium hover:bg-[#9f1d32] hover:text-white transition"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No orders found</p>
                      </div>
                    )}
                  </div>

                  {/* View All Orders Button */}
                  {!ordersLoading && (
                    <div className="flex justify-center mt-8">
                      <button
                        onClick={() => navigate("/orders")}
                        className="px-8 py-3 bg-[#B5223B] text-white font-semibold rounded-md hover:bg-[#9f1d32] transition"
                      >
                        View All Orders
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "wishlist" && (
                <div className="p-2 md:p-6 mb-24">
                  <div className="collection_grid">
                    <div className="products_list grid grid-cols-2 md:grid-cols-4 md:gap-5 gap-2">
                      {wishlistLoading ? (
                        <div className="col-span-full flex justify-center py-10">
                          <AiOutlineLoading3Quarters className="animate-spin text-3xl text-[#B5223B]" />
                        </div>
                      ) : wishlistProducts.length === 0 ? (
                        <div className="col-span-full text-center py-10">
                          <p className="text-gray-500">Your wishlist is empty</p>
                        </div>
                      ) : (
                        wishlistProducts.map((product) => (
                          <ProductCard
                            key={product._id}
                            product={{
                              id: product._id,
                              slug: product.slug,
                              title: product.name,
                              image: product.image?.url,
                              priceSale: product.priceSale,
                              price: product.price,
                              rating: product.averageRating || 0,
                              isWishlisted: true,
                              isBestSeller: product.isBestSeller,
                              isTopCollection: product.isTopCollection,
                            }}
                            wishListDone={() => { fetchWishlistProducts(); }}
                          />
                        ))
                      )}
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
