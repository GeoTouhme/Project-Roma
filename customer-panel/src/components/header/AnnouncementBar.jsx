import React, { useState, useEffect } from "react";

const ANNOUNCEMENT_KEY = "announcement_dismissed";

const messages = [
  "Free delivery on orders over $75 | Newport Beach & surrounding areas",
  "🍷 New arrivals: Premium Bourbons & Tequilas now in stock!",
  "📍 4521 W Coast Hwy, Newport Beach, CA 92663 | Open Mon-Sun 9AM-10PM",
];

const AnnouncementBar = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(ANNOUNCEMENT_KEY) === "true";
    setIsDismissed(dismissed);
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsDismissed(true);
      sessionStorage.setItem(ANNOUNCEMENT_KEY, "true");
    }, 300);
  };

  if (isDismissed && !isAnimating) return null;

  return (
    <div
      className={`
        bg-[#1a1a1a] text-white text-center py-[10px] px-4 text-[13px] font-medium
        transition-all duration-300 relative
        ${isAnimating ? "announcement-dismiss" : "announcement-enter"}
      `}
      style={{ height: isDismissed ? "0" : "auto", overflow: "hidden" }}
    >
      <div className="container relative">
        <span className="inline-block animate-fade-in">
          {messages[currentMessageIndex]}
        </span>
        <button
          onClick={handleDismiss}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-1"
          aria-label="Dismiss announcement"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBar;
