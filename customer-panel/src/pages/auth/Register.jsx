import React, { useState } from "react";
import AuthService from "../../services/authServices";
import GoogleSignInButton from "../../components/google-signin/GoogleSignInButton";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validate = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";

    // Email validation
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email)) newErrors.email = "Please enter a valid email address";

    // Password validation
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) newErrors.password = "Password must include uppercase, lowercase, and a number";

    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    // Phone validation
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[0-9+\s()-]{7,15}$/.test(formData.phone)) newErrors.phone = "Please enter a valid phone number";

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);

      const { confirmPassword, ...submitData } = formData;
      AuthService.register(submitData)
        .then((response) => {
          if (response.success) {
            if (response.emailSent === false) {
              setRegisteredEmail(submitData.email);
              setEmailSendFailed(true);
              toast.error(
                "Account created, but we couldn't send the verification email. Please use Resend below or contact support.",
                { duration: 6000 }
              );
            } else {
              toast.success("Account created! Please check your email to verify.", { duration: 5000 });
              navigate("/login");
            }
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

  const handleResendVerification = () => {
    if (!registeredEmail) return;
    setIsResending(true);

    AuthService.resendOtp({ email: registeredEmail })
      .then((response) => {
        if (response.success && response.emailSent !== false) {
          toast.success("Verification email resent! Please check your inbox.");
          setEmailSendFailed(false);
          setTimeout(() => navigate("/login"), 3000);
        } else {
          toast.error(response.message || "Could not resend email. Please try again shortly.", { duration: 5000 });
        }
      })
      .catch((error) => {
        toast.error(error.message || "Could not resend email.");
      })
      .finally(() => {
        setIsResending(false);
      });
  };

  return (
    <>
      <div className="main py-4">
        <div className="page-title text-center mx-auto">
          <h2 className="text-3xl font-bold mb-2">Register</h2>
          <p className="text-gray-600">Create an account to get started</p>
        </div>
      </div>

      <div className="main py-4">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="bg-white shadow-md rounded-lg p-8">
            <div className="mb-6">
              <GoogleSignInButton text="signup_with" />
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign up with email</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="firstName">
                  First Name *
                </label>
                <input
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? "border-red-500" : "border-gray-300"
                    }`}
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lastName">
                  Last Name *
                </label>
                <input
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? "border-red-500" : "border-gray-300"
                    }`}
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                  Email *
                </label>
                <input
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? "border-red-500" : "border-gray-300"
                    }`}
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john.doe@example.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
                  Phone *
                </label>
                <input
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? "border-red-500" : "border-gray-300"
                    }`}
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (123) 456-7890"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                  Password *
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

              {/* Confirm Password */}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
                  Confirm Password *
                </label>
                <input
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? "border-red-500" : "border-gray-300"
                    }`}
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="********"
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full ${isSubmitting ? 'bg-[#B5223B]/80 cursor-not-allowed' : 'bg-[#B5223B] hover:bg-[#B5223B]'} text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out`}
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </button>
            </div>

            {/* Login Link */}
            <div className="text-center mt-6">
              <p className="text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="text-[#B5223B] hover:underline">
                  Login here
                </Link>
              </p>
            </div>

            {emailSendFailed && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800 text-sm mb-3">
                  Account created, but the verification email could not be sent to{" "}
                  <strong>{registeredEmail}</strong>.
                </p>
                <button
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className={`w-full ${
                    isResending ? "bg-gray-400 cursor-not-allowed" : "bg-[#B5223B] hover:bg-[#B5223B]/90"
                  } text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out`}
                >
                  {isResending ? "Resending..." : "Resend Verification Email"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
