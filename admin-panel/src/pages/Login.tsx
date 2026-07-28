import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ArrowRight, User, Shield } from "lucide-react";
import { Navigate } from "react-router-dom";

const Login = () => {
  const { login, verifyMfa, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      console.log("[Login] login result:", JSON.stringify(result));
      if (result.mfaRequired && result.tempToken) {
        console.log("[Login] MFA required — switching to code entry");
        setTempToken(result.tempToken);
        setShowMfa(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = mfaCode.replace(/\s/g, "");
    if (code.length !== 6) {
      console.log("[Login] MFA code too short:", code.length);
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyMfa(tempToken, code);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <div className="animate-slide-up w-full max-w-md glassmorphism rounded-2xl p-8 shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-3 rounded-full">
            {!showMfa ? (
              <User className="h-10 w-10 text-primary" />
            ) : (
              <Shield className="h-10 w-10 text-primary" />
            )}
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {!showMfa ? "Admin Panel" : "Two-Factor Authentication"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {!showMfa
              ? "Sign in to your admin account"
              : "Enter the 6-digit code from your authenticator app"}
          </p>
        </div>

        {!showMfa ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exm@example.com"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 group"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting || isLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="mfa-code" className="text-sm font-medium text-center block">
                6-digit authenticator code
              </label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
                className="h-12 text-center text-2xl tracking-[0.5em] font-semibold"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 group"
              disabled={isSubmitting || isLoading || mfaCode.replace(/\s/g, "").length !== 6}
            >
              {isSubmitting || isLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Verify Code
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setShowMfa(false);
                setMfaCode("");
                setTempToken("");
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Back to password sign-in
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
