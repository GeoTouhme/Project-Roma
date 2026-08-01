import React, { useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { login } from "../../redux/authSlice";
import AuthService from "../../services/authServices";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

const loadGoogleScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

const GoogleSignInButton = ({ text = "signin_with" }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const buttonRef = useRef(null);

  const handleCredentialResponse = useCallback(
    async (response) => {
      try {
        const res = await AuthService.googleAuth({ idToken: response.credential });
        if (!res.success) {
          toast.error(res.message || "Google sign-in failed", { duration: 3000 });
          return;
        }

        localStorage.setItem("user", JSON.stringify(res.user));
        dispatch(login(res.token));
        toast.success(res.message || "Signed in with Google", { duration: 2000 });
        navigate("/");
      } catch (error) {
        console.error("Google sign-in error:", error);
        toast.error(error?.message || "Google sign-in failed. Please try again.", {
          duration: 3000,
        });
      }
    },
    [dispatch, navigate]
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn("REACT_APP_GOOGLE_CLIENT_ID is not configured; Google sign-in is disabled.");
      return;
    }

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (buttonRef.current) {
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            width: "100%",
            text,
            shape: "rectangular",
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load Google Identity Services:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [handleCredentialResponse, text]);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  return <div ref={buttonRef} className="w-full" />;
};

export default GoogleSignInButton;
