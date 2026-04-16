import React, { useEffect, useState } from "react";
import "./MaintenancePage.css";
import Logo from "../../assets/images/Logo.png";

const MaintenancePage = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="maintenance-page">
      <div className={`maintenance-content ${loaded ? "loaded" : ""}`}>
        <div className="logo-container">
          <img
            src={Logo}
            alt="Bal-Port Liquors Logo"
            className="logo-image"
          />
        </div>

        <div className="divider"></div>

        <h2 className="heading">We're Building Something Great</h2>
        <p className="subtext">
          Our online store is currently under development.
          <br />
          Stay tuned!
        </p>

        <div className="contact-info">
          <div className="contact-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="contact-icon"
            >
              <path
                d="M21 10C21 10 19 7 12 7C5 7 3 10 3 10C3 10 3 14 7 17L10.5 20L12 21L13.5 20L17 17C21 14 21 10 21 10Z"
                stroke="#B5223B"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z"
                stroke="#B5223B"
                strokeWidth="1.5"
              />
            </svg>
            <span>4521 W Coast Hwy, Newport Beach, CA 92663</span>
          </div>

          <div className="contact-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="contact-icon"
            >
              <path
                d="M22 16.92V19.92C22 20.48 21.5 20.95 20.95 20.95C10.45 20.95 2.05 12.55 2.05 2.05C2.05 1.5 2.5 1 3.05 1H6.05C6.55 1 7.05 1.45 7.15 1.95C7.35 2.95 7.65 3.85 8.05 4.75C8.2 5.1 8.15 5.5 7.95 5.8L6.55 8.2C7.35 9.85 8.15 10.55 9.35 11.35L10.95 10.05C11.2 9.85 11.5 9.75 11.85 9.75H14.05C17.35 9.75 20.25 11.05 22.45 13.25C22.65 13.45 22.8 13.65 22.95 13.85C22.5 15.05 22.35 15.95 22.25 16.92H22Z"
                stroke="#B5223B"
                strokeWidth="1.5"
              />
            </svg>
            <span>(949) 642-1921</span>
          </div>
        </div>

        <div className="footer-text">
          <p>We appreciate your patience</p>
        </div>
      </div>

      <div className="background-pattern"></div>
    </div>
  );
};

export default MaintenancePage;