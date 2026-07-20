import api from "./api";

export const fetchDevices = async () => {
  const response = await api.get(`/monitor/devices`);
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchAlarms = async () => {
  const response = await api.get(`/monitor/alarms`);
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchMachineAlarms = async (mcId) => {
  const response = await api.get(`/monitor/alarms`);
  const data = Array.isArray(response.data) ? response.data : [];
  const alarms = mcId ? data.filter((a) => a.mcId === mcId) : data;
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

  // Transform alarms to format expected by MachinePage
  const formatted = alarms.map((a) => ({
    id: a.id,
    mcId: a.mcId,
    deviceName: a.deviceName,
    zone: a.zone,
    plant: a.plant,
    type: a.type,
    status: a.status || "Uninspected",
    confidence: Math.round(a.confidence || 0),
    timestamp: a.timestamp,
    // Transform imageUrl to images array for snapshot viewer
    images: a.imageUrl ? [
      {
        id: `img-${a.id}`,
        url: `${apiUrl}/monitor${a.imageUrl}`, // concat with base URL if relative path
        // thumb: `${apiUrl}/monitor${a.imageUrl}`,
        capturedAt: a.timestamp,
      }
    ] : [],
  }));
  // console.log("Fetched and formatted alarms:", formatted);
  // console.log("Fetched and formatted alarms:", formatted.map(a => ({ id: a.id, mcId: a.mcId, deviceName: a.deviceName, status: a.status, confidence: a.confidence })));
  return formatted;
};

export const updateAlarmStatus = async (alarmId, newStatus) => {
  const response = await api.put(`/monitor/alarms/${alarmId}`, { status: newStatus });
  return response.data;
};

import Swal from 'sweetalert2';

export const ClearAlarms = async (mcId,count) => {
  try {
    const confirmation = await confirmClearalarm(count);
    if (!confirmation.isConfirmed) {
      return { success: false, message: 'User cancelled the action.' };
    }
    if (count === 0) {
        Swal.fire({
          icon: 'error',
          title: 'Failed to clear alarms',
          text:'No false alarms to clear.',
      });
      return {
        success: false,
        message: 'No false alarms to clear.',
      };
    }
    const response = await api.delete(`/monitor/alarms/${mcId}`);
    if (response.status === 200) {
      Swal.fire({
        icon: 'success',
        title: 'Cleared successfully',
        text: response.data?.message || 'False alarms have been cleared.',
        showConfirmButton: true,
      });

      return {
        success: true,
        message: response.data?.message || 'False alarms have been cleared.',
      };
    }

    Swal.fire({
      icon: 'error',
      title: 'Failed to clear alarms',
      text: response.data?.error || 'Unable to clear false alarms.',
    });

    return {
      success: false,
      message: response.data?.error || 'Unable to clear false alarms.',
    };
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Failed to clear alarms',
      text: error?.response?.data?.error || error?.message || 'Unable to clear false alarms.',
    });

    return {
      success: false,
      message: error?.response?.data?.error || error?.message || 'Unable to clear false alarms.',
    };
  }
};


const confirmClearalarm = async (count)=>{
  return Swal.fire({
    title: 'Confirm Clear False Alarms',
    text: `${count == 0 ? 'There are no false alarms to clear.' : `This will clear all ${count} false alarms for this machine.`}`,   
    icon: 'warning',
    showCancelButton: true,
    showConfirmButton: count > 0 ? true : false,
    confirmButtonColor: 'Green',
    cancelButtonColor: '#d33',
    confirmButtonText: 'confirm',
    cancelButtonText: 'cancel',
  });
}