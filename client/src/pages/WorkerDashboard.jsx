import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ClipboardList,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Eye,
  X,
  User,
  ChevronDown,
  LogOut,
  Settings,
  HelpCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowUpCircle,
} from 'lucide-react';

import {
  getAssignedComplaints,
  getWorkerDashboardStats,
  updateComplaintStatus,
} from '../apicalls/workerapi';
import UserProfileCard from '../components/UserProfileCard';
import LoadingPage from '../components/LoadingPage';
import ErrorPage from '../components/ErrorPage';
import useLogoutUser from '../utils/useLogoutUser';

const WorkerDashboard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useLogoutUser();
  const user = useSelector((state) => state.user.user);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch assigned complaints - with aggressive caching and refetch on mount
  const complaintsQuery = useQuery({
    queryKey: ['assigned-complaints', user?.user_id, filters],
    queryFn: () => getAssignedComplaints(filters),
    enabled: !!user?.user_id,
    staleTime: 0, // Always stale, will refetch on mount
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: 60 * 1000, // Refetch every 1 minute
    refetchIntervalInBackground: true, // Refetch even in background
    retry: 2,
    retryDelay: 1000,
  });

  // Fetch dashboard stats - with aggressive caching and refetch on mount
  const statsQuery = useQuery({
    queryKey: ['worker-stats', user?.user_id],
    queryFn: () => getWorkerDashboardStats(),
    enabled: !!user?.user_id,
    staleTime: 0, // Always stale, will refetch on mount
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: 60 * 1000, // Refetch every 1 minute
    refetchIntervalInBackground: true, // Refetch even in background
    retry: 2,
    retryDelay: 1000,
  });

  // Update status mutation with optimistic update
  const updateStatusMutation = useMutation({
    mutationFn: ({ complaint_id, new_status }) => updateComplaintStatus(complaint_id, new_status),
    
    onMutate: async ({ complaint_id, new_status }) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['assigned-complaints', user?.user_id, filters] });
      await queryClient.cancelQueries({ queryKey: ['worker-stats', user?.user_id] });
      
      // Get current data
      const previousComplaints = queryClient.getQueryData(['assigned-complaints', user?.user_id, filters]);
      const previousStats = queryClient.getQueryData(['worker-stats', user?.user_id]);
      
      // Optimistically update complaints
      if (previousComplaints?.complaints) {
        const updatedComplaints = previousComplaints.complaints.map(complaint =>
          complaint.complaint_id === complaint_id
            ? { ...complaint, status: new_status }
            : complaint
        );
        
        queryClient.setQueryData(['assigned-complaints', user?.user_id, filters], {
          ...previousComplaints,
          complaints: updatedComplaints
        });
      }
      
      // Optimistically update stats
      if (previousStats?.statistics) {
        const oldStatus = previousComplaints?.complaints?.find(c => c.complaint_id === complaint_id)?.status;
        const updatedStats = { ...previousStats.statistics };
        
        // Update counts based on status change
        if (oldStatus === 'Assigned' && new_status === 'In Progress') {
          updatedStats.pending_assignment = Math.max(0, (updatedStats.pending_assignment || 0) - 1);
          updatedStats.in_progress = (updatedStats.in_progress || 0) + 1;
        } else if (oldStatus === 'In Progress' && new_status === 'Resolved') {
          updatedStats.in_progress = Math.max(0, (updatedStats.in_progress || 0) - 1);
          updatedStats.resolved = (updatedStats.resolved || 0) + 1;
        } else if (oldStatus === 'Escalated' && new_status === 'In Progress') {
          updatedStats.escalated = Math.max(0, (updatedStats.escalated || 0) - 1);
          updatedStats.in_progress = (updatedStats.in_progress || 0) + 1;
        }
        
        queryClient.setQueryData(['worker-stats', user?.user_id], {
          ...previousStats,
          statistics: updatedStats
        });
      }
      
      toast.info("Updating status...");
      return { previousComplaints, previousStats };
    },
    
    onSuccess: (result, variables, context) => {
      if (result.success) {
        toast.success(result.message || 'Status updated successfully!');
        // Force refetch to ensure consistency
        complaintsQuery.refetch();
        statsQuery.refetch();
      } else {
        // Rollback on failure
        if (context?.previousComplaints) {
          queryClient.setQueryData(['assigned-complaints', user?.user_id, filters], context.previousComplaints);
        }
        if (context?.previousStats) {
          queryClient.setQueryData(['worker-stats', user?.user_id], context.previousStats);
        }
        toast.error(result.message || 'Failed to update status');
      }
      setShowStatusModal(false);
      setSelectedComplaint(null);
      setSelectedStatus('');
    },
    
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousComplaints) {
        queryClient.setQueryData(['assigned-complaints', user?.user_id, filters], context.previousComplaints);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(['worker-stats', user?.user_id], context.previousStats);
      }
      toast.error(error.message || 'Failed to update status');
      setShowStatusModal(false);
      setSelectedComplaint(null);
      setSelectedStatus('');
    },
  });

  const complaints = complaintsQuery.data?.complaints || [];
  const stats = statsQuery.data?.statistics || {
    total_assigned: 0,
    pending_assignment: 0,
    in_progress: 0,
    resolved: 0,
    escalated: 0
  };

  // Filter complaints by search term
  const filteredComplaints = complaints.filter(complaint =>
    complaint.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    complaint.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Manual refresh function
  const handleRefresh = () => {
    complaintsQuery.refetch();
    statsQuery.refetch();
    toast.info("Refreshing data...");
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      'Assigned': 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-purple-100 text-purple-800',
      'Resolved': 'bg-green-100 text-green-800',
      'Escalated': 'bg-red-100 text-red-800',
      'Closed': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getNextStatusOptions = (currentStatus) => {
    const options = {
      'Assigned': [{ value: 'In Progress', label: 'Start Working', icon: <ArrowUpCircle className="h-4 w-4" /> }],
      'In Progress': [{ value: 'Resolved', label: 'Mark as Resolved', icon: <CheckCircle className="h-4 w-4" /> }],
      'Escalated': [{ value: 'In Progress', label: 'Take Back to Progress', icon: <RefreshCw className="h-4 w-4" /> }]
    };
    return options[currentStatus] || [];
  };

  const handleViewComplaint = (complaint) => {
    setSelectedComplaint(complaint);
    setShowComplaintModal(true);
  };

  const handleStatusUpdate = (complaint) => {
    setSelectedComplaint(complaint);
    setSelectedStatus('');
    setShowStatusModal(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedStatus) {
      toast.error('Please select a status');
      return;
    }
    updateStatusMutation.mutate({
      complaint_id: selectedComplaint.complaint_id,
      new_status: selectedStatus
    });
  };

  const getEfficiencyRate = () => {
    const total = stats.total_assigned;
    const resolved = stats.resolved;
    if (total === 0) return 0;
    return Math.round((resolved / total) * 100);
  };

  const isLoading = complaintsQuery.isLoading && complaints.length === 0;
  const isFetching = complaintsQuery.isFetching && complaints.length > 0;

  if (isLoading) {
    return <LoadingPage status="load" message="Loading your dashboard..." />;
  }

  if (complaintsQuery.isError && complaints.length === 0) {
    return <ErrorPage type="error" message="Failed to load dashboard data" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 pt-20">
      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 z-10 bg-white rounded-full p-1"
            >
              <X className="h-5 w-5" />
            </button>
            <UserProfileCard setShowProfile={setShowProfile} />
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Update Status</h2>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complaint: <span className="font-semibold">{selectedComplaint.title}</span>
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Status: 
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(selectedComplaint.status)}`}>
                    {selectedComplaint.status}
                  </span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update to *
                </label>
                <div className="space-y-2">
                  {getNextStatusOptions(selectedComplaint.status).map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedStatus(option.value)}
                      className={`w-full flex items-center justify-center gap-2 p-3 border rounded-lg transition-all ${
                        selectedStatus === option.value
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={!selectedStatus || updateStatusMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Status'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Details Modal */}
      {showComplaintModal && selectedComplaint && (
        <ComplaintDetailsModal
          complaint={selectedComplaint}
          onClose={() => {
            setShowComplaintModal(false);
            setSelectedComplaint(null);
          }}
          onStatusUpdate={() => {
            setShowComplaintModal(false);
            handleStatusUpdate(selectedComplaint);
          }}
          getStatusBadgeColor={getStatusBadgeColor}
          getPriorityBadge={getPriorityBadge}
          canUpdateStatus={getNextStatusOptions(selectedComplaint.status).length > 0}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Worker Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {user?.name?.split(' ')[0] || 'Worker'}!
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={complaintsQuery.isFetching || statsQuery.isFetching}
              className="p-2 text-gray-500 hover:text-purple-600 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`h-5 w-5 ${(complaintsQuery.isFetching || statsQuery.isFetching) ? 'animate-spin' : ''}`} />
            </button>

            {/* Profile Icon */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 focus:outline-none group"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 group-hover:scale-105">
                  <span className="text-sm">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'W'}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold">
                          <span className="text-base">
                            {user?.name ? user.name.charAt(0).toUpperCase() : 'W'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
                          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                          <p className="text-xs text-purple-600 mt-0.5 capitalize">{user?.role} • {user?.department}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowProfile(true);
                        }}
                        className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <User className="h-4 w-4 text-gray-500" />
                        <span>My Profile</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          toast.info('Settings coming soon');
                        }}
                        className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <Settings className="h-4 w-4 text-gray-500" />
                        <span>Settings</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          toast.info('Help section coming soon');
                        }}
                        className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <HelpCircle className="h-4 w-4 text-gray-500" />
                        <span>Help & Support</span>
                      </button>
                      
                      <div className="border-t border-gray-100 my-1"></div>
                      
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Last Updated Info */}
        <div className="text-right text-xs text-gray-400 mb-2">
          Last updated: {new Date().toLocaleTimeString()}
          {complaintsQuery.isFetching && <span className="ml-2 text-purple-500">(Refreshing...)</span>}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Assigned" value={stats.total_assigned} color="text-purple-600" icon={<ClipboardList className="h-5 w-5" />} />
          <StatCard label="Pending" value={stats.pending_assignment} color="text-yellow-600" icon={<Clock className="h-5 w-5" />} />
          <StatCard label="In Progress" value={stats.in_progress} color="text-blue-600" icon={<AlertCircle className="h-5 w-5" />} />
          <StatCard label="Resolved" value={stats.resolved} color="text-green-600" icon={<CheckCircle className="h-5 w-5" />} />
          <StatCard label="Efficiency" value={`${getEfficiencyRate()}%`} color="text-indigo-600" icon={<TrendingUp className="h-5 w-5" />} />
        </div>

        {/* Efficiency Progress Bar */}
        <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Your Resolution Efficiency</span>
            <span className="text-sm font-semibold text-purple-600">{getEfficiencyRate()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${getEfficiencyRate()}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats.resolved} out of {stats.total_assigned} complaints resolved
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student name or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <select
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Escalated">Escalated</option>
            </select>

            <select
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <button
              onClick={() => setFilters({ status: '', priority: '', category: '' })}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Clear Filters
            </button>
          </div>
        </div>

        {/* Complaints List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-gray-800">Assigned Complaints</h3>
            <span className="text-sm text-gray-500">
              Total: {filteredComplaints.length} complaints
              {isFetching && <RefreshCw className="h-3 w-3 animate-spin inline ml-2" />}
            </span>
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No complaints assigned to you</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComplaints.map((complaint) => (
                <ComplaintCard
                  key={complaint.complaint_id}
                  complaint={complaint}
                  onViewDetails={() => handleViewComplaint(complaint)}
                  onUpdateStatus={() => handleStatusUpdate(complaint)}
                  getStatusBadgeColor={getStatusBadgeColor}
                  getPriorityBadge={getPriorityBadge}
                  canUpdateStatus={getNextStatusOptions(complaint.status).length > 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, color, icon }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-gray-500 text-sm font-medium">{label}</h3>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      <div className="p-2 rounded-lg bg-gray-50">
        {icon}
      </div>
    </div>
  </div>
);

// Complaint Card Component
const ComplaintCard = ({ complaint, onViewDetails, onUpdateStatus, getStatusBadgeColor, getPriorityBadge, canUpdateStatus }) => (
  <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h4 className="font-semibold text-gray-800">{complaint.title}</h4>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(complaint.status)}`}>
            {complaint.status}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(complaint.priority)}`}>
            {complaint.priority?.toUpperCase()} Priority
          </span>
        </div>
        <p className="text-sm text-gray-600 line-clamp-2">{complaint.description}</p>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
          <span>ID: #{complaint.complaint_id}</span>
          <span>Category: {complaint.category}</span>
          <span>Student: {complaint.user_name || `User #${complaint.user_id}`}</span>
          <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex gap-2">
        {canUpdateStatus && (
          <button
            onClick={onUpdateStatus}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Update Status
          </button>
        )}
        <button
          onClick={onViewDetails}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
        >
          <Eye className="h-4 w-4" />
          View Details
        </button>
      </div>
    </div>
  </div>
);

// Complaint Details Modal Component
const ComplaintDetailsModal = ({ complaint, onClose, onStatusUpdate, getStatusBadgeColor, getPriorityBadge, canUpdateStatus }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">Complaint Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">{complaint.title}</h3>
              <p className="text-sm text-gray-500 mt-1">Complaint ID: #{complaint.complaint_id}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(complaint.status)}`}>
                {complaint.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityBadge(complaint.priority)}`}>
                {complaint.priority?.toUpperCase()} Priority
              </span>
            </div>
          </div>

          {/* Student Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-700 mb-2">Student Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Name</label>
                <p className="text-gray-800">{complaint.user_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <p className="text-gray-800">{complaint.user_email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Phone</label>
                <p className="text-gray-800">{complaint.user_phone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Complaint Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs text-gray-500 uppercase font-semibold">Category</label>
              <p className="text-gray-800 font-medium mt-1">{complaint.category}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs text-gray-500 uppercase font-semibold">Created At</label>
              <p className="text-gray-800 font-medium mt-1">{new Date(complaint.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="text-xs text-gray-500 uppercase font-semibold">Description</label>
            <div className="mt-2">
              <p className={`text-gray-700 whitespace-pre-wrap ${!showFullDescription && 'line-clamp-4'}`}>
                {complaint.description}
              </p>
              {complaint.description?.length > 300 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="mt-2 text-purple-600 hover:text-purple-700 text-sm font-medium"
                >
                  {showFullDescription ? 'Show Less' : 'Read More'}
                </button>
              )}
            </div>
          </div>

          {/* Remarks */}
          {complaint.remark && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <label className="text-xs text-yellow-700 uppercase font-semibold">Remarks</label>
              <p className="text-gray-700 mt-1">{complaint.remark}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 sticky bottom-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100">
            Close
          </button>
          {canUpdateStatus && (
            <button
              onClick={onStatusUpdate}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Update Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;