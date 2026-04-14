import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
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
  UserPlus
} from 'lucide-react';

import {
  getWorkers,
  getAllComplaints,
  assignComplaint,
  getAuditLogs,
} from '../apicalls/adminapi';
import LoadingPage from '../components/LoadingPage';
import ErrorPage from '../components/ErrorPage';

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const user = useSelector(state => state.user.user);
  const [activeTab, setActiveTab] = useState('workers');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: ''
  });

  // Fetch workers
  const { 
    data: workersData, 
    isLoading: workersLoading,
    isFetching: workersFetching,
    error: workersError 
  } = useQuery({
    queryKey: ['admin-workers'],
    queryFn: () => getWorkers({}),
    enabled: activeTab === 'workers',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch complaints
  const { 
    data: complaintsData, 
    isLoading: complaintsLoading,
    isFetching: complaintsFetching,
    error: complaintsError,
    refetch: refetchComplaints 
  } = useQuery({
    queryKey: ['admin-complaints', filters],
    queryFn: () => getAllComplaints(filters),
    enabled: activeTab === 'complaints',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch audit logs
  const { 
    data: logsData, 
    isLoading: logsLoading,
    isFetching: logsFetching,
    error: logsError 
  } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => getAuditLogs({}),
    enabled: activeTab === 'logs',
    staleTime: 5 * 60 * 1000,
  });

  // Assign complaint mutation
  const assignComplaintMutation = useMutation({
    mutationFn: ({ complaint_id, worker_id }) => assignComplaint(complaint_id, worker_id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-complaints']);
      toast.success('Complaint assigned successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to assign complaint');
    }
  });

  const workers = workersData?.workers || [];
  const complaints = complaintsData?.complaints || [];
  const logs = logsData?.logs || [];

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

  // Loading states
  if (activeTab === 'workers' && (workersLoading || workersFetching)) {
    return <LoadingPage status="load" message="Loading workers data..." />;
  }

  if (activeTab === 'complaints' && (complaintsLoading || complaintsFetching)) {
    return <LoadingPage status="load" message="Loading complaints data..." />;
  }

  if (activeTab === 'logs' && (logsLoading || logsFetching)) {
    return <LoadingPage status="load" message="Loading audit logs..." />;
  }

  // Error states
  if (activeTab === 'workers' && workersError) {
    return <ErrorPage type="error" message="Failed to load workers data" />;
  }

  if (activeTab === 'complaints' && complaintsError) {
    return <ErrorPage type="error" message="Failed to load complaints data" />;
  }

  if (activeTab === 'logs' && logsError) {
    return <ErrorPage type="error" message="Failed to load audit logs" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 pt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {user?.name?.split(' ')[0] || 'Admin'}!</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('workers')}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'workers'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-5 w-5" />
            Workers Management
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'complaints'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-5 w-5" />
            Complaints Management
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Logs className="h-5 w-5" />
            Audit Logs
          </button>
        </div>

        {/* Workers Tab */}
        {activeTab === 'workers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Workers</h2>
              <button
                onClick={() => setShowAddWorker(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
              >
                <UserPlus className="h-5 w-5" />
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
                >
                  <option value="">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>

                <button
                  onClick={() => setFilters({ status: '', category: '', priority: '' })}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
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
                  getStatusBadge={getStatusBadge}
                  getPriorityBadge={getPriorityBadge}
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

      {/* Add Worker Modal - Separate Component */}
      {showAddWorker && (
        <AddWorkerModal
          onClose={() => setShowAddWorker(false)}
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
const UnassignedComplaintCard = ({ complaint, workers, onAssign }) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const relevantWorkers = workers.filter(w => w.department === complaint.category);

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
          >
            <option value="">Select Worker</option>
            {relevantWorkers.map(worker => (
              <option key={worker.user_id} value={worker.user_id}>
                {worker.name} ({worker.department})
              </option>
            ))}
          </select>
          <button
            onClick={() => onAssign(complaint.complaint_id, selectedWorkerId)}
            disabled={!selectedWorkerId}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
};

// Complaint Card Component
const ComplaintCard = ({ complaint, workers, onAssign, getStatusBadge, getPriorityBadge }) => {
  const [showAssign, setShowAssign] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const relevantWorkers = workers.filter(w => w.department === complaint.category);

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
          <p className="text-sm text-gray-600">{complaint.description?.substring(0, 150)}...</p>
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
                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
              >
                Assign
              </button>
              {showAssign && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-10 p-3">
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                  >
                    <option value="">Select Worker</option>
                    {relevantWorkers.map(worker => (
                      <option key={worker.user_id} value={worker.user_id}>
                        {worker.name} ({worker.department})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      onAssign(complaint.complaint_id, selectedWorkerId);
                      setShowAssign(false);
                    }}
                    disabled={!selectedWorkerId}
                    className="w-full px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    Confirm Assign
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Worker Modal Component (Separate, not integrated into main dashboard)
const AddWorkerModal = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    department: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const departments = ['Network', 'Cleaning', 'Carpentry', 'PC Maintenance', 'Plumbing', 'Electricity'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone_number || !formData.department) {
      toast.error('Please fill all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Import dynamically to avoid circular dependency
      const { createWorker } = await import('../apicalls/adminapi');
      const result = await createWorker(formData);
      
      if (result.success) {
        toast.success('Worker created successfully! Credentials sent to email.');
        queryClient.invalidateQueries(['admin-workers']);
        onClose();
      } else {
        toast.error(result.message || 'Failed to create worker');
      }
    } catch (error) {
      console.error('Error creating worker:', error);
      toast.error(error.message || 'Failed to create worker');
    } finally {
      setIsLoading(false);
    }
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {isLoading ? 'Creating...' : 'Create Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;