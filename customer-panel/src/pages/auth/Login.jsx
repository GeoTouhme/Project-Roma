import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../../services/authServices";
import { useDispatch } from "react-redux";
import { login } from "../../redux/authSlice";
import { toast } from "react-hot-toast";

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";

    if (!formData.password) newErrors.password = "Password is required";

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);

      AuthService.login(formData)
        .then((response) => {
          if (response.success) {
            localStorage.setItem("user", JSON.stringify(response.user));
            dispatch(login(response.token));
            navigate("/");
          }
        })
        .catch((error) => {
          console.log("Error:", error);
          if (!error.success) {
            toast.error(error.message, {
              duration: 1000,
            });
          }
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <>
      <div className="main py-4">
        <div className="page-title text-center mx-auto">
          <h2 className="text-3xl font-bold mb-2">Login</h2>
          <p className="text-gray-600">Sign in to your account</p>
        </div>
      </div>

      <div className="main py-4">
        <div className="container mx-auto px-4 max-w-md">
          <div className="bg-white shadow-md rounded-lg p-8">
            {/* Email */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <input
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? "border-red-500" : "border-gray-300"
                  }`}
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.password ? "border-red-500" : "border-gray-300"
                  }`}
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="********"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between mb-6">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-gray-700 text-sm">Remember me</span>
              </label>
              <a href="/forgot-password" className="text-sm text-[#B5223B] hover:underline">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <div className="mb-6">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full ${isSubmitting ? 'bg-[#B5223B]/80 cursor-not-allowed' : 'bg-[#B5223B] hover:bg-[#B5223B]'} text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out`}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </div>

            {/* Register Link */}
            <div className="text-center mt-4">
              <p className="text-gray-600">
                Don't have an account?{" "}
                <Link to="/register" className="text-[#B5223B] hover:underline">
                  Register here
                </Link>
              </p>
            </div>

            {/* Social Login Options */}
            {/* <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <div className="flex items-center justify-center">
                    <span>Google</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <div className="flex items-center justify-center">
                    <span>Facebook</span>
                  </div>
                </button>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
