import api from "../utils/axiosInstance";
import { toast } from "react-toastify";

// ==================== WORKER PROFILE APIs ====================

// ✅ 1. Get Worker Profile
export const getWorkerProfile = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("You must be logged in to view profile");
    return { success: false };
  }

  try {
    const response = await api.get(`/worker/profile`);
    
    if (response.data.success) {
      return {
        success: true,
        profile: response.data.data.profile,
        statistics: response.data.data.statistics
      };
    } else {
      toast.error(response.data.message || "Failed to fetch profile");
      return { success: false };
    }
  } catch (error) {
    console.error("Get profile error:", error);
    const message = error.response?.data?.message || error.message;
    toast.error(`Error: ${message}`);
    return { success: false };
  }
};

// ✅ 2. Get Dashboard Statistics
export const getWorkerDashboardStats = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("You must be logged in to view dashboard");
    return { success: false };
  }

  try {
    const response = await api.get(`/worker/dashboard`);
    
    if (response.data.success) {
      return {
        success: true,
        statistics: response.data.data.statistics,
        recent_complaints: response.data.data.recent_complaints
      };
    } else {
      toast.error(response.data.message || "Failed to fetch dashboard stats");
      return { success: false };
    }
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    const message = error.response?.data?.message || error.message;
    toast.error(`Error: ${message}`);
    return { success: false };
  }
};

// ==================== COMPLAINT MANAGEMENT APIs ====================

// ✅ 3. Get Assigned Complaints
export const getAssignedComplaints = async ({ status, priority, category, page = 1, limit = 10 }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("You must be logged in to view complaints");
    return { success: false };
  }

  try {
    const response = await api.get(`/worker/complaints`, {
      params: {
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        page,
        limit
      }
    });

    if (response.data.success) {
      return {
        success: true,
        complaints: response.data.data,
        pagination: response.data.pagination
      };
    } else {
      toast.error(response.data.message || "Failed to fetch complaints");
      return { success: false };
    }
  } catch (error) {
    console.error("Get complaints error:", error);
    const message = error.response?.data?.message || error.message;
    toast.error(`Error: ${message}`);
    return { success: false };
  }
};

// ✅ 4. Get Single Complaint Details
export const getComplaintById = async (complaint_id) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("You must be logged in to view complaint details");
    return { success: false };
  }

  try {
    const response = await api.get(`/worker/complaints/${complaint_id}`);
    
    if (response.data.success) {
      return {
        success: true,
        complaint: response.data.data
      };
    } else {
      toast.error(response.data.message || "Failed to fetch complaint details");
      return { success: false };
    }
  } catch (error) {
    console.error("Get complaint details error:", error);
    const message = error.response?.data?.message || error.message;
    toast.error(`Error: ${message}`);
    return { success: false };
  }
};

// ✅ 5. Update Complaint Status
export const updateComplaintStatus = async (complaint_id, new_status) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("You must be logged in to update status");
    return { success: false };
  }

  try {
    const response = await api.put(`/worker/complaints/${complaint_id}/status`, {
      new_status
    });
    
    if (response.data.success) {
      toast.success(response.data.message || "Status updated successfully!");
      return {
        success: true,
        complaint: response.data.data
      };
    } else {
      toast.error(response.data.message || "Failed to update status");
      return { success: false };
    }
  } catch (error) {
    console.error("Update status error:", error);
    const message = error.response?.data?.message || error.message;
    toast.error(`Error: ${message}`);
    return { success: false };
  }
};

// ✅ 6. Add Remark to Complaint
export const addRemark = async (complaint_id, remark) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("You must be logged in to add remark");
    return { success: false };
  }

  try {
    const response = await api.post(`/worker/complaints/${complaint_id}/remark`, { remark });
    
    if (response.data.success) {
      toast.success(response.data.message || "Remark added successfully!");
      return {
        success: true,
        complaint: response.data.data
      };
    } else {
      toast.error(response.data.message || "Failed to add remark");
      return { success: false };
    }
  } catch (error) {
    console.error("Add remark error:", error);
    const message = error.response?.data?.message || error.message;
    toast.error(`Error: ${message}`);
    return { success: false };
  }
};

// ✅ 7. Get Status History
export const getStatusHistory = async (complaint_id) => {
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error("You must be logged in to view history");
    return { success: false };
  }

  try {
    const response = await api.get(`/worker/complaints/${complaint_id}/history`);
    
    if (response.data.success) {
      return {
        success: true,
        history: response.data.data,
        count: response.data.count
      };
    } else {
      toast.error(response.data.message || "Failed to fetch history");
      return { success: false };
    }
  } catch (error) {
    console.error("Get history error:", error);
    const message = error.response?.data?.message || error.message;
    toast.error(`Error: ${message}`);
    return { success: false };
  }
};