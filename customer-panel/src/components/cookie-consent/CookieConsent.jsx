import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("cookieConsent");
      if (!consent) {
        // Small delay to prevent sudden pop on first render
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.error("Cookie consent check error", e);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("cookieConsent", "accepted");
    } catch (e) {
      console.error(e);
    }
    setIsVisible(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem("cookieConsent", "essential_only");
    } catch (e) {
      console.error(e);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-0 inset-x-0 z-[9990] p-3 md:p-6 pointer-events-none transition-all duration-500 ease-out animate-fadeInUp"
    >
      <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-md text-gray-900 border border-gray-200 shadow-2xl rounded-2xl p-4 md:p-5 pointer-events-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Text & Icon */}
        <div className="flex items-start gap-3 flex-1">
          <div className="text-2xl flex-shrink-0 mt-0.5" role="img" aria-label="Cookie">
            🍪
          </div>
          <div className="text-sm text-gray-700 leading-relaxed">
            <p className="font-semibold text-gray-900 mb-0.5">We Value Your Privacy</p>
            <p>
              We use cookies to enhance your shopping experience, remember your preferences, and analyze site traffic. By clicking{" "}
              <span className="font-semibold text-gray-900">"Accept All"</span>, you consent to our use of cookies. Learn more in our{" "}
              <Link
                to="/privacy-policy"
                className="text-primary hover:underline font-medium"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-shrink-0">
          <button
            type="button"
            onClick={handleDecline}
            className="flex-1 md:flex-none px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-center"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 md:flex-none px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-opacity-95 shadow-sm rounded-xl transition-all text-center"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
