import api from "./api";

// ── API Endpoints for settings management ──


export const getMonitoringData = async () => {
    const response = await api.get(`/monitor/devices`);
    return Array.isArray(response.data) ? response.data : [];
};

export const updateSettings = async (mcId,payload) => {
    const response = await api.put(`/settings/`+mcId, payload);
    // console.log(payload)
    return response.data;   
}
