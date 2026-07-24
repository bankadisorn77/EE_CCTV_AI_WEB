import api from "./api";
import Swal from "sweetalert2";
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

export const resetDevice = async (mcId) => {
    const firstConfirm = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#16a34a',
        confirmButtonText: 'Yes',
        cancelButtonText: 'No',
    });

    if (!firstConfirm.isConfirmed) return;

    const deleteResult = await Swal.fire({
        title: 'Confirm Deletion',
        text: 'Type "DELETE" to reset and delete this device',
        input: 'text',
        inputPlaceholder: 'DELETE',
        inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
        },
        showCancelButton: true,
        confirmButtonText: 'Delete Device',
        confirmButtonColor: '#dc2626',
        showLoaderOnConfirm: true,
        preConfirm: async (value) => {
        if (value !== 'DELETE') {
            Swal.showValidationMessage('You must type "DELETE" to confirm!');
            return false;
        }

        try {
            const response = await api.delete(`/settings/reset/${mcId}`);
            return response.data; 
        } catch (error) {
    
            const errorMessage = error?.response?.data?.error || error?.response?.data?.details || 'Failed to reset device';
            Swal.showValidationMessage(`Error: ${errorMessage}`);
            return false;
        }
        },
        allowOutsideClick: () => !Swal.isLoading(),
    });

    if (deleteResult.isConfirmed) {
        await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'The device has been successfully deleted.',
        timer: 1500,
        showConfirmButton: false,
        });
    }
    };


export const restartDevice = async (mcId) => {
    Swal.fire({
        title: 'Restart Machine?',
        text: 'The device will turn off and automatically reconnect when ready.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626', 
        cancelButtonColor: '#16a34a',
        confirmButtonText: 'Yes',
        cancelButtonText: 'No',
        
    }).then(async (result) => {
        if (result.isConfirmed) {
            const respones = await api.post(`/settings/restart/`+mcId+``);
            if(respones.status === 200){
                // console.log(respones.data)
                Swal.fire({
                    icon: 'success',
                    title: 'restared!',
                    text: 'The device has been successfully restarted.',
                    timer: 1500,
                    showConfirmButton: false,
                });
            }else{
                console.log(respones.status)
                Swal.fire({
                    icon: 'error',
                    title:'Failed to restar',
                    text: 'The device can not be restarted.',
                    timer: 1500,
                    showConfirmButton: false,
                })
            }
        }
    })
}