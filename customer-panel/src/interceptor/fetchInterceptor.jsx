import axios from "axios";
import { API_BASE_URL } from "../config/AppConfig";
import store from "../redux/store";
import { logout } from "../redux/authSlice";

const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100000,
  withCredentials: true,
});

// API Request interceptor
service.interceptors.request.use(
  (config) => {
    // 🛡️ SECURITY: JWT is stored in an HttpOnly cookie sent automatically by the browser.
    // Do not read or inject the token from localStorage/Authorization header.
    return config;
  },
  (error) => {
    console.log("error = ", error);
    return Promise.reject(error);
  }
);

// Normalize an error so callers always receive an object with { success, message }.
function normalizeError(error) {
  if (error.response) {
    const { data, status } = error.response;
    // Backend usually returns JSON: { success: false, message: '...' }
    if (data && typeof data === "object" && "message" in data) {
      return { success: false, status, ...data };
    }
    // If the server returned an HTML error page (e.g. 502/504), wrap it.
    return { success: false, status, message: `Server error ${status}` };
  }
  if (error.request) {
    return { success: false, message: "Network error. Please check your connection." };
  }
  return { success: false, message: error.message || "An unexpected error occurred" };
}

// 🛡️ SECURITY: Refresh token rotation.
// One in-flight refresh at a time — queue concurrent 401s and replay them
// after the refresh resolves rather than firing multiple /auth/refresh calls.
let isRefreshing = false;
let failedQueue = [];

function processQueue(error) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
}

async function tryRefreshToken() {
  if (isRefreshing) {
    // Another request is already refreshing — wait for it.
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    await axios.post(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      { withCredentials: true }
    );
    processQueue(null);
  } catch (err) {
    processQueue(err);
    throw err;
  } finally {
    isRefreshing = false;
  }
}

// API response interceptor
service.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // 🛡️ Auto-refresh: on 401 attempt one silent token refresh then replay.
    // _retried guards against an infinite loop if /auth/refresh itself 401s.
    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      // Never retry the refresh or login endpoints themselves.
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      originalRequest._retried = true;

      try {
        await tryRefreshToken();
        // Refresh succeeded — replay the original request.
        return service(originalRequest);
      } catch {
        // Refresh failed — session is gone, force logout.
        store.dispatch(logout());
        window.location.href = "/login";
        return Promise.reject(
          normalizeError({ message: "Session expired. Please log in again." })
        );
      }
    }

    const normalized = normalizeError(error);
    console.log("API error:", normalized);
    return Promise.reject(normalized);
  }
);

export default service;

