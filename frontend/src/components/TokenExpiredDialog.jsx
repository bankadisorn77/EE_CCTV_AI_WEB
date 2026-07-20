import { useEffect } from 'react';
import { useTokenExpired } from '../context/TokenExpiredContext';
import { refreshToken, logout } from '../services/apiAuth';
import Swal from 'sweetalert2';

export default function TokenExpiredDialog() {
  const { isOpen, closeDialog, timeUntilLogout, setTimeUntilLogout } = useTokenExpired();

  // Timer countdown logic
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setTimeUntilLogout((prev) => {
        if (prev <= 1) {
          // Auto logout หลังจาก 60 วินาที
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, setTimeUntilLogout]);

  const handleRefresh = async () => {
    try {
      const data = await refreshToken();
      const newToken = data.accessToken;
      
      closeDialog();
      
      // Call callback ที่ api.js ตั้งไว้ เพื่อ retry request เก่า
      if (window.onTokenRefreshed) {
        window.onTokenRefreshed(newToken);
      }

      Swal.fire({
        icon: 'success',
        title: 'Token refreshed successfully',
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to refresh token',
        text: err?.message || 'Cannot refresh token, please login again',
        confirmButtonColor: '#4f46e5',
      });
      
      // Call failure callback
      if (window.onTokenRefreshFailed) {
        window.onTokenRefreshFailed();
      }
      
      handleLogout();
    }
  };

  const handleLogout = () => {
    logout();
    closeDialog();
    window.location.href = '/login';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm mx-4">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-red-600 mb-2">Session Expired</h2>
          <p className="text-gray-600">
            Your access token has expired. Please click the refresh button to continue.
          </p>
        </div>

        {/* Timer Display */}
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-gray-600 mb-1">If no action is taken, you will be logged out automatically in</p>
          <p className="text-3xl font-bold text-red-600 text-center">
            {timeUntilLogout} seconds
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            ✓ Refresh Token
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
          >
            × Logout
          </button>
        </div>
      </div>
    </div>
  );
}
