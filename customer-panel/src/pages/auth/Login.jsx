import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../../services/authServices";
import GoogleSignInButton from "../../components/google-signin/GoogleSignInButton";
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

  // 🛡️ MFA state — backend now requires a TOTP code after password login.
  const [showMfa, setShowMfa] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");

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

  const finalizeLogin = (response) => {
    if (!response.user) {
      toast.error("Login failed. Please try again.");
      return;
    }
    localStorage.setItem("user", JSON.stringify(response.user));
    dispatch(login(response.token));
    navigate("/");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);

      AuthService.login(formData)
        .then((response) => {
          if (!response.success) {
            toast.error(response.message || "Login failed", { duration: 1000 });
            return;
          }

          // 🛡️ MFA: password was correct, now prompt for authenticator code.
          if (response.mfaRequired) {
            setShowMfa(true);
            setTempToken(response.tempToken || "");
            setMfaCode("");
            return;
          }

          finalizeLogin(response);
        })
        .catch((error) => {
          console.log("Error:", error);
          const message = error?.message || "An error occurred during login";
          toast.error(message, { duration: 1000 });
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    } else {
      setErrors(newErrors);
    }
  };

  const handleMfaSubmit = (e) => {
    e.preventDefault();
    const code = mfaCode.replace(/\s/g, "");
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit code from your authenticator app");
      return;
    }

    setIsSubmitting(true);
    AuthService.verifyMfa({ tempToken, code })
      .then((response) => {
        if (!response.success) {
          toast.error(response.message || "Invalid MFA code", { duration: 1000 });
          return;
        }
        finalizeLogin(response);
      })
      .catch((error) => {
        console.log("MFA Error:", error);
        const message = error?.message || "An error occurred during MFA verification";
        toast.error(message, { duration: 1000 });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleBackToPassword = () => {
    setShowMfa(false);
    setTempToken("");
    setMfaCode("");
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
            {!showMfa ? (
              <>
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
              </>
            ) : (
              <>
                {/* MFA Code */}
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mfa-code">
                    Two-Factor Authentication Code
                  </label>
                  <p className="text-gray-600 text-sm mb-3">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-[0.5em] font-semibold"
                    id="mfa-code"
                    name="mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    autoFocus
                  />
                </div>

                {/* MFA Submit Button */}
                <div className="mb-4">
                  <button
                    onClick={handleMfaSubmit}
                    disabled={isSubmitting || mfaCode.replace(/\s/g, "").length !== 6}
                    className={`w-full ${isSubmitting || mfaCode.replace(/\s/g, "").length !== 6 ? 'bg-[#B5223B]/80 cursor-not-allowed' : 'bg-[#B5223B] hover:bg-[#B5223B]'} text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out`}
                  >
                    {isSubmitting ? "Verifying..." : "Verify Code"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleBackToPassword}
                  className="w-full text-center text-sm text-gray-600 hover:text-[#B5223B]"
                >
                  Back to password sign-in
                </button>
              </>
            )}

            {/* Google Sign-In */}
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6">
                <GoogleSignInButton text="signin_with" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
