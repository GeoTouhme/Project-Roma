import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import AuthService from "../../services/authServices";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying, success, error, invalid

  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const otp = searchParams.get("otp");

  useEffect(() => {
    // Prefer the signed token from the email link; fall back to manual email + OTP.
    if (token) {
      AuthService.verifyEmailToken({ token })
        .then((response) => {
          if (response.success) {
            setStatus("success");
            if (response.user) {
              localStorage.setItem("user", JSON.stringify(response.user));
            }
            toast.success("Email verified successfully! You can now log in.");
            setTimeout(() => navigate("/login"), 3000);
          }
        })
        .catch((error) => {
          setStatus("error");
          toast.error(error.message || "Verification failed");
        });
      return;
    }

    if (!email || !otp) {
      setStatus("invalid");
      return;
    }

    AuthService.verifyOtp({ email, otp })
      .then((response) => {
        if (response.success) {
          setStatus("success");
          if (response.user) {
            localStorage.setItem("user", JSON.stringify(response.user));
          }
          toast.success("Email verified successfully! You can now log in.");
          setTimeout(() => navigate("/login"), 3000);
        }
      })
      .catch((error) => {
        setStatus("error");
        toast.error(error.message || "Verification failed");
      });
  }, [token, email, otp, navigate]);

  const renderContent = () => {
    switch (status) {
      case "verifying":
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B5223B] mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying your email...</p>
          </div>
        );
      case "success":
        return (
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-6">Your account has been verified successfully.</p>
            <Link
              to="/login"
              className="inline-block bg-[#B5223B] text-white font-bold py-3 px-8 rounded-md hover:bg-[#B5223B]/90 transition"
            >
              Log In
            </Link>
          </div>
        );
      case "error":
        return (
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">✗</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">The verification link is invalid or has expired.</p>
            <Link
              to="/register"
              className="inline-block bg-[#B5223B] text-white font-bold py-3 px-8 rounded-md hover:bg-[#B5223B]/90 transition"
            >
              Register Again
            </Link>
          </div>
        );
      case "invalid":
      default:
        return (
          <div className="text-center">
            <div className="text-yellow-500 text-6xl mb-4">!</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Link</h2>
            <p className="text-gray-600 mb-6">Please use the verification link from your email.</p>
            <Link
              to="/register"
              className="inline-block bg-[#B5223B] text-white font-bold py-3 px-8 rounded-md hover:bg-[#B5223B]/90 transition"
            >
              Register
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="main py-16">
      <div className="container mx-auto px-4 max-w-md">
        <div className="bg-white shadow-md rounded-lg p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;