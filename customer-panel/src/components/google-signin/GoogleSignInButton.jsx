import React, { useEffect, useRef, useCallback, useState } from "react";
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
  const [tempToken, setTempToken] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const finishSignIn = useCallback((res) => {
    if (!res.user) throw new Error('Login failed. Please try again.');
    localStorage.setItem('user', JSON.stringify(res.user));
    dispatch(login());
    toast.success(res.message || 'Signed in with Google', { duration: 2000 });
    navigate('/');
  }, [dispatch, navigate]);

  const handleCredentialResponse = useCallback(
    async (response) => {
      try {
        const res = await AuthService.googleAuth({ idToken: response.credential });
        if (!res.success) {
          toast.error(res.message || "Google sign-in failed", { duration: 3000 });
          return;
        }

        if (res.mfaRequired) {
          setTempToken(res.tempToken || '');
          setCode('');
          return;
        }
        finishSignIn(res);
      } catch (error) {
        console.error("Google sign-in error:", error);
        toast.error(error?.message || "Google sign-in failed. Please try again.", {
          duration: 3000,
        });
      }
    },
    [finishSignIn]
  );

  const verifyMfa = async (event) => {
    event.preventDefault();
    setVerifying(true);
    try {
      const res = await AuthService.verifyMfa({ tempToken, code });
      if (!res.success) throw new Error(res.message || 'Invalid MFA code');
      finishSignIn(res);
    } catch (error) {
      toast.error(error.message || 'Unable to verify code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

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

  return <>
    <div ref={buttonRef} className={tempToken ? 'hidden' : 'w-full'} />
    {tempToken && <form onSubmit={verifyMfa} className="space-y-3">
      <label className="block">Authenticator code
        <input className="block w-full border rounded p-2" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} />
      </label>
      <button className="w-full rounded bg-[#B5223B] text-white p-3 disabled:opacity-50" disabled={verifying || code.length !== 6} type="submit">{verifying ? 'Verifying…' : 'Verify code'}</button>
      <button className="underline" type="button" onClick={() => { setTempToken(''); setCode(''); }}>Back to Google sign-in</button>
    </form>}
  </>;
};

export default GoogleSignInButton;
