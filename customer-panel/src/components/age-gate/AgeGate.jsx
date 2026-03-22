import React, { useState, useEffect } from 'react';
import Logo from '../../assets/images/Logo.png';

const AgeGate = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already verified their age
    const ageVerified = localStorage.getItem('ageVerified');
    if (!ageVerified) {
      setIsVisible(true);
      // Prevent scrolling when age gate is visible
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem('ageVerified', 'true');
    // Set an expiration if needed, but for now simple localStorage is fine
    // For real cookies with expiration: document.cookie = "ageVerified=true; max-age=" + 30*24*60*60;
    setIsVisible(false);
    document.body.style.overflow = 'auto';
  };

  const handleReject = () => {
    window.location.href = 'https://www.google.com';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm p-4 text-white">
      <div className="max-w-md w-full bg-white text-gray-900 rounded-2xl p-8 shadow-2xl text-center border-t-8 border-primary">
        <div className="mb-6 flex justify-center">
          <img src={Logo} alt="Balport Liquors" className="h-16 object-contain" />
        </div>
        
        <h2 className="text-2xl font-bold mb-4 text-primary">Just Checking</h2>
        
        <p className="text-gray-700 text-lg mb-8 font-semibold">
          Please verify that you are 21 years of age or older
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleReject}
            className="px-6 py-3 border-2 border-gray-200 rounded-lg text-gray-500 font-semibold hover:bg-gray-50 transition-colors"
          >
            No
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 shadow-md transition-all active:transform active:scale-95"
          >
            Yes, I am 21+
          </button>
        </div>
        
        <p className="mt-8 text-xs text-gray-400">
          By clicking enter, you agree to our Terms of Service and Privacy Policy. Please drink responsibly.
        </p>
      </div>
    </div>
  );
};

export default AgeGate;
