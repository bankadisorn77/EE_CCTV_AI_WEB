// services/api.js
import axios from "axios";
import { refreshToken, logout } from "./apiAuth";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050/api' });

let isRefreshing = false;
let failedQueue = [];

// ฟังก์ชันสำหรับปล่อยคิว Request ที่รออยู่ให้ทำงานต่อ
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Global callback สำหรับ Dialog เรียกหลังจาก refresh สำเร็จ
window.onTokenRefreshed = null;

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) {
    // ใช้ .set() เพื่อความเสถียรสำหรับ Axios เวอร์ชั่นใหม่
    if (config.headers && config.headers.set) {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // เพิ่ม 400 เข้าไปด้วย เนื่องจาก Backend ของเราอาจส่ง 400 มาตอน Token หมดอายุ
    if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 400) {
      
      // ถ้าเคย retry ไปแล้วแต่ยังศาล → logout ถาวร
      if (originalRequest._retry) {
        processQueue(error, null);
        logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // ถ้ามีคิว request รออยู่ → เพิ่มในคิว
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Mark as retry
      originalRequest._retry = true;
      isRefreshing = true;

      // ❌ ไม่ Auto Refresh Token แล้ว
      // ✅ Dispatch event ไปยัง Dialog component เพื่อให้ผู้ใช้เลือก
      const tokenExpiredEvent = new CustomEvent('tokenExpired', { detail: { error, originalRequest } });
      window.dispatchEvent(tokenExpiredEvent);

      // Setup callback ที่ Dialog จะเรียก หลังจาก refresh สำเร็จ
      window.onTokenRefreshed = (newToken) => {
        isRefreshing = false;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      };

      // ปล่อยให้ Dialog แสดง
      return new Promise((resolve, reject) => {
        // Store resolve/reject สำหรับ Dialog
        window.onTokenRefreshFailed = () => {
          isRefreshing = false;
          processQueue(error, null);
          logout();
          reject(error);
        };
      });
    }
    return Promise.reject(error);
  }
);

export default api;