import axios from "axios";
import { API_BASE_URL } from "../config/AppConfig";

const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100000,
  withCredentials: true,
});

// API Request interceptor
service.interceptors.request.use(
  (config) => {
    // 🛡️ SECURITY: JWT is now stored in an HttpOnly cookie sent automatically by the browser.
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

// API response interceptor
service.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const normalized = normalizeError(error);
    console.log("API error:", normalized);
    return Promise.reject(normalized);
  }
);

export default service;
