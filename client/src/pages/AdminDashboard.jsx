import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Users,
  FileText,
  Logs,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Phone,
  Briefcase,
  Award,
  BarChart3,
  UserPlus,
  RefreshCw,
  X,
  ChevronDown,
  LogOut,
  Settings,
  HelpCircle,
  User,
  Shield
} from 'lucide-react';

import {
  getWorkers,
  getAllComplaints,
  assignComplaint,
  getAuditLogs,
  createWorker
} from '../apicalls/adminapi';
import LoadingPage from '../components/LoadingPage';
import ErrorPage from '../components/ErrorPage';
import { resetUser } from '../slices/userSlice';
import useLogoutUser from '../utils/useLogoutUser';

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const logout = useLogoutUser();
  const user = useSelector(state => state.user.user);
  const [activeTab, setActiveTab] = useState('workers');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: ''
  });

  // Fetch workers - with aggressive caching and refetch on mount
  const workersQuery = useQuery({
    queryKey: ['admin-workers'],
    queryFn: () => getWorkers({}),
    staleTime: 0, // Always stale, will refetch on mount
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: 60 * 1000, // Refetch every 1 minute
    refetchIntervalInBackground: true, // Refetch even in background
    retry: 2,
    retryDelay: 1000,
    onError: (error) => {
      toast.error(error.message || "Failed to load workers");
    }
  });

  // Fetch complaints - with aggressive caching and refetch on mount
  const complaintsQuery = useQuery({
    queryKey: ['admin-complaints', filters],
    queryFn: () => getAllComplaints(filters),
    staleTime: 0, // Always stale, will refetch on mount
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: 60 * 1000, // Refetch every 1 minute
    refetchIntervalInBackground: true, // Refetch even in background
    retry: 2,
    retryDelay: 1000,
    onError: (error) => {
      toast.error(error.message || "Failed to load complaints");
    }
  });

  // Fetch audit logs - with aggressive caching and refetch on mount
  const logsQuery = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => getAuditLogs({}),
    staleTime: 0, // Always stale, will refetch on mount
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: 60 * 1000, // Refetch every 1 minute
    refetchIntervalInBackground: true, // Refetch even in background
    retry: 2,
    retryDelay: 1000,
    onError: (error) => {
      toast.error(error.message || "Failed to load audit logs");
    }
  });

  // Create worker mutation with optimistic update
  const createWorkerMutation = useMutation({
    mutationFn: createWorker,
    
    onMutate: async (newWorkerData) => {
      await queryClient.cancelQueries({ queryKey: ['admin-workers'] });
      
      const previousWorkers = queryClient.getQueryData(['admin-workers']);
      
      const optimisticWorker = {
        user_id: `temp-${Date.now()}`,
        name: newWorkerData.name,
        email: newWorkerData.email,
        phone_number: newWorkerData.phone_number,
        department: newWorkerData.department,
        total_assigned: 0,
        in_progress_count: 0,
        resolved_count: 0,
        escalated_count: 0,
        efficiency: 0,
        created_at: new Date().toISOString()
      };
      
      if (previousWorkers?.workers) {
        queryClient.setQueryData(['admin-workers'], {
          ...previousWorkers,
          workers: [optimisticWorker, ...previousWorkers.workers],
          count: previousWorkers.count + 1
        });
      }
      
      toast.info("Adding worker...");
      
      return { previousWorkers };
    },
    
    onSuccess: (result, variables, context) => {
      if (result.success && result.data) {
        const currentWorkers = queryClient.getQueryData(['admin-workers']);
        if (currentWorkers?.workers) {
          const updatedWorkers = currentWorkers.workers.map(worker => 
            worker.user_id === `temp-${Date.now()}` ? result.data : worker
          );
          queryClient.setQueryData(['admin-workers'], {
            ...currentWorkers,
            workers: updatedWorkers
          });
        }
        toast.success('Worker created successfully! Credentials sent to email.');
        // Force refetch to ensure consistency
        workersQuery.refetch();
      } else {
        if (context?.previousWorkers) {
          queryClient.setQueryData(['admin-workers'], context.previousWorkers);
        }
        toast.error(result?.message || 'Failed to create worker');
      }
      setShowAddWorker(false);
    },
    
    onError: (error, variables, context) => {
      if (context?.previousWorkers) {
        queryClient.setQueryData(['admin-workers'], context.previousWorkers);
      }
      toast.error(error.message || 'Failed to create worker');
      setShowAddWorker(false);
    },
  });

  // Assign complaint mutation with optimistic update
  const assignComplaintMutation = useMutation({
    mutationFn: ({ complaint_id, worker_id }) => assignComplaint(complaint_id, worker_id),
    
    onMutate: async ({ complaint_id, worker_id }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-complaints', filters] });
      
      const previousComplaints = queryClient.getQueryData(['admin-complaints', filters]);
      const workers = workersQuery.data?.workers || [];
      const selectedWorker = workers.find(w => w.user_id === worker_id);
      
      if (previousComplaints?.complaints) {
        const updatedComplaints = previousComplaints.complaints.map(complaint => 
          complaint.complaint_id === complaint_id 
            ? { 
                ...complaint, 
                assigned_to: worker_id,
                worker_name: selectedWorker?.name,
                status: 'Assigned'
              }
            : complaint
        );
        
        queryClient.setQueryData(['admin-complaints', filters], {
          ...previousComplaints,
          complaints: updatedComplaints
        });
      }
      
      toast.info("Assigning complaint...");
      
      return { previousComplaints };
    },
    
    onSuccess: (result, variables, context) => {
      if (result.success) {
        toast.success('Complaint assigned successfully!');
        // Force refetch to ensure consistency
        complaintsQuery.refetch();
      } else {
        if (context?.previousComplaints) {
          queryClient.setQueryData(['admin-complaints', filters], context.previousComplaints);
        }
        toast.error(result?.message || 'Failed to assign complaint');
      }
    },
    
    onError: (error, variables, context) => {
      if (context?.previousComplaints) {
        queryClient.setQueryData(['admin-complaints', filters], context.previousComplaints);
      }
      toast.error(error.message || 'Failed to assign complaint');
    },
  });

  const workers = workersQuery.data?.workers || [];
  const complaints = complaintsQuery.data?.complaints || [];
  const logs = logsQuery.data?.logs || [];

  const isLoadingWorkers = workersQuery.isLoading && workers.length === 0;
  const isLoadingComplaints = complaintsQuery.isLoading && complaints.length === 0;
  const isLoadingLogs = logsQuery.isLoading && logs.length === 0;
  const isRefetchingWorkers = workersQuery.isFetching && workers.length > 0;
  const isRefetchingComplaints = complaintsQuery.isFetching && complaints.length > 0;
  const isRefetchingLogs = logsQuery.isFetching && logs.length > 0;

  const hasError = 
    (activeTab === 'workers' && workersQuery.isError && workers.length === 0) ||
    (activeTab === 'complaints' && complaintsQuery.isError && complaints.length === 0) ||
    (activeTab === 'logs' && logsQuery.isError && logs.length === 0);

  const getErrorMessage = () => {
    if (activeTab === 'workers' && workersQuery.error) return workersQuery.error.message;
    if (activeTab === 'complaints' && complaintsQuery.error) return complaintsQuery.error.message;
    if (activeTab === 'logs' && logsQuery.error) return logsQuery.error.message;
    return 'Failed to load data';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Submitted': 'bg-yellow-100 text-yellow-800',
      'Assigned': 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-purple-100 text-purple-800',
      'Resolved': 'bg-green-100 text-green-800',
      'Closed': 'bg-gray-100 text-gray-800',
      'Escalated': 'bg-red-100 text-red-800',
      'Withdrawn': 'bg-orange-100 text-orange-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800'
    };
    return badges[priority] || 'bg-gray-100 text-gray-800';
  };

  const unassignedComplaints = complaints.filter(c => !c.assigned_to && c.status === 'Submitted');

  const handleViewComplaint = (complaint) => {
    setSelectedComplaint(complaint);
    setShowComplaintModal(true);
  };

  // Manual refresh function
  const handleRefresh = () => {
    workersQuery.refetch();
    complaintsQuery.refetch();
    logsQuery.refetch();
    toast.info("Refreshing data...");
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'A';
    return user.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get gradient color based on user name
  const getAvatarGradient = () => {
    const gradients = [
      'from-purple-500 to-indigo-600',
      'from-pink-500 to-rose-600',
      'from-blue-500 to-cyan-600',
      'from-green-500 to-emerald-600',
      'from-orange-500 to-red-600',
      'from-teal-500 to-green-600',
    ];
    const index = (user?.name?.length || 0) % gradients.length;
    return gradients[index];
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  if (activeTab === 'workers' && isLoadingWorkers) {
    return <LoadingPage status="load" message="Loading workers data..." />;
  }

  if (activeTab === 'complaints' && isLoadingComplaints) {
    return <LoadingPage status="load" message="Loading complaints data..." />;
  }

  if (activeTab === 'logs' && isLoadingLogs) {
    return <LoadingPage status="load" message="Loading audit logs..." />;
  }

  if (hasError) {
    return <ErrorPage type="error" message={getErrorMessage()} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 pt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header with Admin Profile Icon */}
        <div className="mb-6 flex justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {user?.name?.split(' ')[0] || 'Admin'}!</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={workersQuery.isFetching || complaintsQuery.isFetching || logsQuery.isFetching}
              className="p-2 text-gray-500 hover:text-purple-600 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`h-5 w-5 ${(workersQuery.isFetching || complaintsQuery.isFetching || logsQuery.isFetching) ? 'animate-spin' : ''}`} />
            </button>

            {/* Admin Profile Icon */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 focus:outline-none group"
              >
                <div className={`
                  flex items-center justify-center h-10 w-10 rounded-full 
                  bg-gradient-to-br ${getAvatarGradient()} 
                  text-white font-semibold shadow-md 
                  hover:shadow-lg transition-all duration-200
                  group-hover:scale-105
                `}>
                  <span className="text-sm">{getUserInitials()}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`
                          flex items-center justify-center h-12 w-12 rounded-full 
                          bg-gradient-to-br ${getAvatarGradient()} 
                          text-white font-semibold
                        `}>
                          <span className="text-base">{getUserInitials()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
                          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                          <p className="text-xs text-purple-600 mt-0.5 capitalize flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {user?.role} • {user?.department || 'System Administrator'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          toast.info('Profile settings coming soon');
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
                        onClick={handleLogout}
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
          {(workersQuery.isFetching || complaintsQuery.isFetching || logsQuery.isFetching) && 
            <span className="ml-2 text-purple-500">(Refreshing...)</span>}
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('workers')}
            disabled={workersQuery.isLoading}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'workers'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Users className="h-5 w-5" />
            Workers Management
            {isRefetchingWorkers && (
              <RefreshCw className="h-4 w-4 animate-spin ml-2" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            disabled={complaintsQuery.isLoading}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'complaints'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <FileText className="h-5 w-5" />
            Complaints Management
            {isRefetchingComplaints && (
              <RefreshCw className="h-4 w-4 animate-spin ml-2" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            disabled={logsQuery.isLoading}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Logs className="h-5 w-5" />
            Audit Logs
            {isRefetchingLogs && (
              <RefreshCw className="h-4 w-4 animate-spin ml-2" />
            )}
          </button>
        </div>

        {/* Workers Tab */}
        {activeTab === 'workers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Workers</h2>
              <button
                onClick={() => setShowAddWorker(true)}
                disabled={createWorkerMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createWorkerMutation.isPending ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
                Add New Worker
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {workers.map((worker) => (
                <WorkerCard key={worker.user_id} worker={worker} />
              ))}
            </div>

            {workers.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No workers found</p>
                <button
                  onClick={() => setShowAddWorker(true)}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Add Your First Worker
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <select
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  disabled={complaintsQuery.isFetching}
                >
                  <option value="">All Status</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Withdrawn">Withdrawn</option>
                </select>

                <select
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  disabled={complaintsQuery.isFetching}
                >
                  <option value="">All Categories</option>
                  <option value="Network">Network</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Carpentry">Carpentry</option>
                  <option value="PC Maintenance">PC Maintenance</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electricity">Electricity</option>
                </select>

                <select
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  disabled={complaintsQuery.isFetching}
                >
                  <option value="">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>

                <button
                  onClick={() => setFilters({ status: '', category: '', priority: '' })}
                  disabled={complaintsQuery.isFetching}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Unassigned Complaints Section */}
            {unassignedComplaints.length > 0 && (
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Unassigned Complaints ({unassignedComplaints.length})
                </h3>
                <div className="space-y-3">
                  {unassignedComplaints.map((complaint) => (
                    <UnassignedComplaintCard
                      key={complaint.complaint_id}
                      complaint={complaint}
                      workers={workers}
                      onAssign={(complaintId, workerId) => {
                        assignComplaintMutation.mutate({ complaint_id: complaintId, worker_id: workerId });
                      }}
                      isAssigning={assignComplaintMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Complaints List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800">All Complaints</h3>
              {complaints.map((complaint) => (
                <ComplaintCard
                  key={complaint.complaint_id}
                  complaint={complaint}
                  workers={workers}
                  onAssign={(complaintId, workerId) => {
                    assignComplaintMutation.mutate({ complaint_id: complaintId, worker_id: workerId });
                  }}
                  onViewDetails={() => handleViewComplaint(complaint)}
                  getStatusBadge={getStatusBadge}
                  getPriorityBadge={getPriorityBadge}
                  isAssigning={assignComplaintMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{log.user_name || 'System'}</div>
                        <div className="text-xs text-gray-500">{log.user_role}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.entity_type}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                        {log.old_value && <span className="text-xs">From: {JSON.stringify(log.old_value)}</span>}
                        {log.new_value && <span className="text-xs ml-2">To: {JSON.stringify(log.new_value)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Complaint Details Modal */}
      {showComplaintModal && selectedComplaint && (
        <ComplaintDetailsModal
          complaint={selectedComplaint}
          onClose={() => {
            setShowComplaintModal(false);
            setSelectedComplaint(null);
          }}
          getStatusBadge={getStatusBadge}
          getPriorityBadge={getPriorityBadge}
        />
      )}

      {/* Add Worker Modal */}
      {showAddWorker && (
        <AddWorkerModal
          onClose={() => setShowAddWorker(false)}
          onSubmit={createWorkerMutation.mutate}
          isLoading={createWorkerMutation.isPending}
        />
      )}
    </div>
  );
};

// Worker Card Component
const WorkerCard = ({ worker }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800">{worker.name}</h3>
            <p className="text-sm text-gray-500">{worker.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                {worker.department}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                ID: {worker.user_id}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-purple-600 hover:text-purple-700"
          >
            <Eye className="h-5 w-5" />
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{worker.phone_number}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Total: {worker.total_assigned}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm">In Progress: {worker.in_progress_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Resolved: {worker.resolved_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Efficiency: {worker.efficiency}%</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Escalated: {worker.escalated_count}</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${worker.efficiency}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Resolution Efficiency</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Unassigned Complaint Card
const UnassignedComplaintCard = ({ complaint, workers, onAssign, isAssigning }) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const relevantWorkers = workers.filter(w => w.department === complaint.category);

  const handleAssign = () => {
    if (!selectedWorkerId) {
      toast.error('Please select a worker');
      return;
    }
    onAssign(complaint.complaint_id, selectedWorkerId);
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-yellow-200">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800">{complaint.title}</h4>
          <p className="text-sm text-gray-600 mt-1">Category: {complaint.category}</p>
          <p className="text-sm text-gray-500">From: {complaint.user_name || `User #${complaint.user_id}`}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isAssigning}
          >
            <option value="">Select Worker</option>
            {relevantWorkers.map(worker => (
              <option key={worker.user_id} value={worker.user_id}>
                {worker.name} ({worker.department})
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedWorkerId || isAssigning}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
          >
            {isAssigning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Complaint Card Component
const ComplaintCard = ({ complaint, workers, onAssign, onViewDetails, getStatusBadge, getPriorityBadge, isAssigning }) => {
  const [showAssign, setShowAssign] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const relevantWorkers = workers.filter(w => w.department === complaint.category);

  const handleAssign = () => {
    if (!selectedWorkerId) {
      toast.error('Please select a worker');
      return;
    }
    onAssign(complaint.complaint_id, selectedWorkerId);
    setShowAssign(false);
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className="font-semibold text-gray-800">{complaint.title}</h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(complaint.status)}`}>
              {complaint.status}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(complaint.priority)}`}>
              {complaint.priority?.toUpperCase()} Priority
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{complaint.description?.substring(0, 150)}...</p>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            <span>ID: #{complaint.complaint_id}</span>
            <span>Category: {complaint.category}</span>
            <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
            {complaint.worker_name && <span>Assigned to: {complaint.worker_name}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!complaint.assigned_to && complaint.status === 'Submitted' && (
            <div className="relative">
              <button
                onClick={() => setShowAssign(!showAssign)}
                disabled={isAssigning}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Assign
              </button>
              {showAssign && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-10 p-3">
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                    disabled={isAssigning}
                  >
                    <option value="">Select Worker</option>
                    {relevantWorkers.map(worker => (
                      <option key={worker.user_id} value={worker.user_id}>
                        {worker.name} ({worker.department})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedWorkerId || isAssigning}
                    className="w-full px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAssigning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      'Confirm Assign'
                    )}
                  </button>
                </div>
              )}
            </div>
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
};

// Complaint Details Modal Component
const ComplaintDetailsModal = ({ complaint, onClose, getStatusBadge, getPriorityBadge }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">Complaint Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
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
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(complaint.status)}`}>
                {complaint.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityBadge(complaint.priority)}`}>
                {complaint.priority?.toUpperCase()} Priority
              </span>
            </div>
          </div>

          {/* Complaint Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs text-gray-500 uppercase font-semibold">Category</label>
              <p className="text-gray-800 font-medium mt-1">{complaint.category}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs text-gray-500 uppercase font-semibold">Created By</label>
              <p className="text-gray-800 font-medium mt-1">{complaint.user_name || `User #${complaint.user_id}`}</p>
              <p className="text-xs text-gray-500">{complaint.user_email}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs text-gray-500 uppercase font-semibold">Created At</label>
              <p className="text-gray-800 font-medium mt-1">{new Date(complaint.created_at).toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs text-gray-500 uppercase font-semibold">Last Updated</label>
              <p className="text-gray-800 font-medium mt-1">
                {complaint.updated_at ? new Date(complaint.updated_at).toLocaleString() : 'N/A'}
              </p>
            </div>
            {complaint.assigned_to && (
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="text-xs text-gray-500 uppercase font-semibold">Assigned To</label>
                <p className="text-gray-800 font-medium mt-1">{complaint.worker_name || `Worker #${complaint.assigned_to}`}</p>
                {complaint.worker_department && <p className="text-xs text-gray-500">{complaint.worker_department}</p>}
              </div>
            )}
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

          {/* Media Attachments */}
          {complaint.media_urls && complaint.media_urls.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs text-gray-500 uppercase font-semibold">Attachments</label>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {complaint.media_urls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 bg-white rounded-lg border hover:shadow-md transition"
                  >
                    {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                      <img src={url} alt={`Attachment ${index + 1}`} className="w-full h-24 object-cover rounded" />
                    ) : url.match(/\.(mp4|mov|avi)$/i) ? (
                      <video className="w-full h-24 object-cover rounded" />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-gray-100 rounded">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1 truncate">File {index + 1}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          {complaint.remark && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <label className="text-xs text-yellow-700 uppercase font-semibold">Remarks</label>
              <p className="text-gray-700 mt-1">{complaint.remark}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


// Add Worker Modal Component
const AddWorkerModal = ({ onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    department: ''
  });

  const departments = ['Network', 'Cleaning', 'Carpentry', 'PC Maintenance', 'Plumbing', 'Electricity'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone_number || !formData.department) {
      toast.error('Please fill all fields');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Add New Worker</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isLoading}>
            <XCircle className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isLoading}
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isLoading} 
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Worker'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;