// import axios from "axios";
// import { toast } from "react-toastify";

// const API_BASE = import.meta.env.VITE_API_BASE;

// const api = axios.create({
//   baseURL: API_BASE,
//   withCredentials: false,
// });

// const AUTH_ROUTES = [
//   "/auth/send-otp",
//   "/auth/verify-otp",
//   "/auth/signup",
//   "/auth/login",
//   "/auth/reset-password",
//   "/auth/change-password",
//   "/auth/profile",
//   "/auth/refresh-token",
// ];

// const isAuthRoute = (url = "") =>
//   AUTH_ROUTES.some((route) => url.includes(route));

// // ── Request Interceptor ──────────────────────────────────────────
// api.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem("token");
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // ── Response Interceptor ─────────────────────────────────────────
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     const { response, config } = error;
//     const requestUrl = config?.url || "";

//     // 🔍 DEBUG — remove these logs once issue is fixed
//     console.log("❌ Interceptor caught error");
//     console.log("   URL     :", requestUrl);
//     console.log("   Status  :", response?.status);
//     console.log("   Message :", response?.data?.message);
//     console.log("   isAuthRoute:", isAuthRoute(requestUrl));

//     // Network error
//     if (!response) {
//       toast.error("Network error. Please check your internet connection.");
//       return Promise.reject(error);
//     }

//     const status = response.status;

//     // Auth routes — let authapi.js handle toasts
//     if (isAuthRoute(requestUrl)) {
//       console.log("✅ Auth route — skipping global toast/redirect");
//       return Promise.reject(error);
//     }

//     // Protected routes
//     switch (status) {
//       case 400:
//         toast.error(response.data?.message || "Bad request. Please check your input.");
//         break;
//       case 401:
//         toast.error("Session expired. Please login again.");
//         localStorage.removeItem("token");
//         window.location.href = "/";
//         break;
//       case 403:
//         toast.error("You don't have permission to do that.");
//         break;
//       case 404:
//         toast.error(response.data?.message || "Resource not found.");
//         break;
//       case 422:
//         toast.error(response.data?.message || "Validation failed. Please check your form.");
//         break;
//       case 500:
//         toast.error("Server error. Please try again later.");
//         break;
//       default:
//         toast.error(response.data?.message || "An unexpected error occurred.");
//         break;
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;

import axios from "axios";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

const AUTH_ROUTES = [
  "/auth/send-otp",
  "/auth/verify-otp",
  "/auth/signup",
  "/auth/login",
  "/auth/reset-password",
  "/auth/change-password",
  "/auth/profile",
  "/auth/refresh-token",
];

const isAuthRoute = (url = "") =>
  AUTH_ROUTES.some((route) => url.includes(route));

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config } = error;
    const requestUrl = config?.url || "";

    // Network error
    if (!response) {
      toast.error("Network error. Please check your internet connection.");
      return Promise.reject(error);
    }

    const status = response.status;

    // Auth routes — let authapi.js handle toasts
    if (isAuthRoute(requestUrl)) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (status === 401) {
      const message = response.data?.message || "Session expired. Please login again.";
      toast.error(message);
      
      // Clear storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Don't redirect here, let the component handle it
      // This prevents redirect loops
      return Promise.reject(error);
    }

    // Handle other status codes
    switch (status) {
      case 400:
        toast.error(response.data?.message || "Bad request. Please check your input.");
        break;
      case 403:
        toast.error(response.data?.message || "You don't have permission to do that.");
        break;
      case 404:
        toast.error(response.data?.message || "Resource not found.");
        break;
      case 422:
        toast.error(response.data?.message || "Validation failed. Please check your form.");
        break;
      case 500:
        toast.error("Server error. Please try again later.");
        break;
      default:
        toast.error(response.data?.message || "An unexpected error occurred.");
        break;
    }

    return Promise.reject(error);
  }
);

export default api;