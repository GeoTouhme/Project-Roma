import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/AppConfig";

const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100000,
});

// Config
const TOKEN_PAYLOAD_KEY = "authorization";
const PUBLIC_REQUEST_KEY = "public-request";

// API Request interceptor
service.interceptors.request.use(
  (config) => {
    const jwtToken = localStorage.getItem("auth_token");

    if (jwtToken) {
      config.headers[TOKEN_PAYLOAD_KEY] = "Bearer " + jwtToken;
    }

    if (!jwtToken && !config.headers[PUBLIC_REQUEST_KEY]) {
      const navigate = useNavigate();
      navigate("/");
    }

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
