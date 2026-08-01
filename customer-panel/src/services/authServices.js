import fetch from "../interceptor/fetchInterceptor";

const AuthService = {};

AuthService.login = function (data) {
  return fetch({
    url: "auth/login",
    method: "post",
    data: data,
  });
};

AuthService.register = function (data) {
  return fetch({
    url: "auth/register",
    method: "post",
    data: data,
  });
};

AuthService.googleAuth = function (data) {
  return fetch({
    url: "auth/google",
    method: "post",
    data: data,
  });
};

AuthService.verifyOtp = function (data) {
  return fetch({
    url: "auth/verify-otp",
    method: "post",
    data: data,
  });
};

AuthService.verifyEmailToken = function (data) {
  return fetch({
    url: "auth/verify-email-token",
    method: "post",
    data: data,
  });
};

AuthService.resendOtp = function (data) {
  return fetch({
    url: "auth/resend-otp",
    method: "post",
    data: data,
  });
};

// 🛡️ MFA: verify TOTP code after password login.
AuthService.verifyMfa = function (data) {
  return fetch({
    url: "auth/verify-mfa",
    method: "post",
    data: data,
  });
};

// 🛡️ MFA: start enrollment (returns QR code + manual key).
AuthService.setupMfa = function () {
  return fetch({
    url: "auth/setup-mfa",
    method: "post",
  });
};

// 🛡️ MFA: confirm enrollment with the first TOTP code.
AuthService.confirmMfa = function (data) {
  return fetch({
    url: "auth/confirm-mfa",
    method: "post",
    data: data,
  });
};

// 🛡️ MFA: disable MFA for the authenticated user.
AuthService.disableMfa = function (data) {
  return fetch({
    url: "auth/disable-mfa",
    method: "post",
    data: data,
  });
};

export default AuthService;
