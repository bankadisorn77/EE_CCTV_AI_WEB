import api from './api'; // สมมติว่ามีไฟล์ api.js สำหรับจัดการ axios instance

export async function getUsers({ page = 1, limit = 10, search = '' }) {
  try {
    const response = await api.get('/users', {
      params: { page, limit, search }
    });
    return response.data;
  } catch (error) {
    console.error('API Error fetching users:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Could not fetch users');
  }
}

export async function updateUser(userId, data) {
  try {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  } catch (error) {
    console.error('API Error updating user:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Could not update user');
  }
}

export async function deleteUser(userId) {
  try {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('API Error deleting user:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Could not delete user');
  }
}