import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/AppConfig";

const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100000,
  withCredentials: true,
});

// Config
const PUBLIC_REQUEST_KEY = "public-request";

// API Request interceptor
service.interceptors.request.use(
  (config) => {
    // 🛡️ SECURITY: JWT is now stored in an HttpOnly cookie sent automatically by the browser.
    // Do not read or inject the token from localStorage/Authorization header.
    return config;
  },
  (error) => {
    console.log("error = ", error);
    Promise.reject(error);
  }
);

// API respone interceptor
service.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.log(error);

    if (error.response.status === 403 || error.response.status === 401) {
      const navigate = useNavigate();
      navigate("/");
    }
    return Promise.reject(error.response.data);
  }
);

export default service;
