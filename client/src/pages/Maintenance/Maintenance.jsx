import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, Wrench, Clock, CheckCircle2, AlertTriangle, 
  UserCheck, Play, Check, X, ShieldAlert, AlertCircle, Image 
} from 'lucide-react';

const Maintenance = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Form states
  const [raiseFormData, setRaiseFormData] = useState({
    assetId: '',
    issueDescription: '',
    priority: 'MEDIUM',
    photoUrl: ''
  });
  const [assignFormData, setAssignFormData] = useState({
    technicianId: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqsRes, employeesRes] = await Promise.all([
        api.get('/maintenance?limit=100'),
        api.get('/employees?limit=100')
      ]);

      setRequests(reqsRes.data.data);
      setEmployees(employeesRes.data.data || []);
      
      // Attempt to load assets for select form
      // Since Dev B might not have completed the assets route, we fallback to a mock list if it fails
      try {
        const assetsRes = await api.get('/assets?limit=100');
        setAssets(assetsRes.data.data || []);
      } catch (err) {
        console.warn('Failed to load assets from server, using demo assets');
        setAssets([
          { id: '1', assetTag: 'AF-0001', name: 'Conference Room Projector' },
          { id: '2', assetTag: 'AF-0002', name: 'MacBook Pro 16"' },
          { id: '3', assetTag: 'AF-0003', name: 'Dell UltraSharp 27" Monitor' },
          { id: '4', assetTag: 'AF-0004', name: 'HP LaserJet Enterprise Printer' },
          { id: '5', assetTag: 'AF-0005', name: 'Ergonomic Desk Chair' }
        ]);
      }
    } catch (err) {
      console.error('Error fetching maintenance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRaiseSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/maintenance', {
        assetId: raiseFormData.assetId,
        issueDescription: raiseFormData.issueDescription,
        priority: raiseFormData.priority,
        photoUrl: raiseFormData.photoUrl || undefined
      });
      setIsRaiseModalOpen(false);
      setRaiseFormData({ assetId: '', issueDescription: '', priority: 'MEDIUM', photoUrl: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error raising maintenance request');
    }
  };

  const handleApprove = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this maintenance request?')) return;
    try {
      await api.put(`/maintenance/${requestId}/approve`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error approving request');
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this maintenance request?')) return;
    try {
      await api.put(`/maintenance/${requestId}/reject`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error rejecting request');
    }
  };

  const handleAssignClick = (req) => {
    setSelectedRequest(req);
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/maintenance/${selectedRequest.id}/assign-technician`, {
        technicianId: assignFormData.technicianId
      });
      setIsAssignModalOpen(false);
      setAssignFormData({ technicianId: '' });
      setSelectedRequest(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error assigning technician');
    }
  };

  const handleStartWork = async (requestId) => {
    try {
      await api.put(`/maintenance/${requestId}/start`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error starting work');
    }
  };

  const handleResolve = async (requestId) => {
    if (!window.confirm('Mark this maintenance issue as fully resolved?')) return;
    try {
      await api.put(`/maintenance/${requestId}/resolve`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error resolving request');
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  // Group requests by status
  const columns = {
    PENDING: { title: 'Pending Approval', color: 'border-yellow-500 bg-yellow-50/30', list: [] },
    APPROVED: { title: 'Approved / Backlog', color: 'border-blue-500 bg-blue-50/30', list: [] },
    TECHNICIAN_ASSIGNED: { title: 'Assigned', color: 'border-purple-500 bg-purple-50/30', list: [] },
    IN_PROGRESS: { title: 'In Progress', color: 'border-orange-500 bg-orange-50/30', list: [] },
    RESOLVED: { title: 'Resolved', color: 'border-green-500 bg-green-50/30', list: [] }
  };

  // Add rejected to columns list locally for rendering alongside resolved or separate, 
  // but let's focus on the workflow cards as specified in 3A.6
  requests.forEach(req => {
    if (columns[req.status]) {
      columns[req.status].list.push(req);
    } else if (req.status === 'REJECTED') {
      // Show rejected under Resolved column marked as rejected
      columns.RESOLVED.list.push(req);
    }
  });

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'ASSET_MANAGER';

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading maintenance records...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Wrench className="text-blue-600" /> Maintenance Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track asset issues, assignments, and repairs</p>
        </div>
        <button
          onClick={() => setIsRaiseModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Raise Request
        </button>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(columns).map(([statusKey, col]) => (
          <div key={statusKey} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{col.title}</span>
            <span className="text-2xl font-bold text-gray-900 mt-2">{col.list.length}</span>
          </div>
        ))}
      </div>

      {/* Workflow Kanban Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {Object.entries(columns).map(([statusKey, col]) => (
          <div key={statusKey} className={`rounded-2xl border-t-4 p-4 shadow-sm min-h-[500px] flex flex-col gap-4 ${col.color} bg-white`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-800 text-sm">{col.title}</h3>
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {col.list.length}
              </span>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1">
              {col.list.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  No requests
                </div>
              ) : (
                col.list.map((req) => (
                  <div key={req.id} className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3">
                    {/* Priority & Tag */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-700">{req.asset?.assetTag}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full uppercase ${getPriorityBadgeClass(req.priority)}`}>
                        {req.priority}
                      </span>
                    </div>

                    {/* Details */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-800">{req.asset?.name}</h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-3 leading-relaxed">{req.issueDescription}</p>
                    </div>

                    {/* Photo indicator */}
                    {req.photoUrl && (
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <Image size={12} /> Photo attached
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t border-gray-50 flex flex-col gap-1.5">
                      {req.status === 'PENDING' && isAdminOrManager && (
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => handleApprove(req.id)}
                            className="flex-1 text-[11px] font-bold bg-green-50 text-green-700 hover:bg-green-100 py-1.5 rounded-lg border border-green-200 transition-colors flex items-center justify-center gap-1"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="flex-1 text-[11px] font-bold bg-red-50 text-red-700 hover:bg-red-100 py-1.5 rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-1"
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      )}

                      {req.status === 'APPROVED' && isAdminOrManager && (
                        <button
                          onClick={() => handleAssignClick(req)}
                          className="w-full text-[11px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 py-1.5 border border-purple-200 rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <UserCheck size={12} /> Assign Tech
                        </button>
                      )}

                      {req.status === 'TECHNICIAN_ASSIGNED' && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                            Tech: {req.technician?.name || 'Assigned'}
                          </span>
                          {(user?.id === req.technicianId || isAdminOrManager) && (
                            <button
                              onClick={() => handleStartWork(req.id)}
                              className="w-full text-[11px] font-bold bg-orange-600 hover:bg-orange-700 text-white py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                            >
                              <Play size={12} /> Start Work
                            </button>
                          )}
                        </div>
                      )}

                      {req.status === 'IN_PROGRESS' && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                            Tech: {req.technician?.name || 'Assigned'}
                          </span>
                          {(user?.id === req.technicianId || isAdminOrManager) && (
                            <button
                              onClick={() => handleResolve(req.id)}
                              className="w-full text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 size={12} /> Resolve Issue
                            </button>
                          )}
                        </div>
                      )}

                      {req.status === 'RESOLVED' && (
                        <div className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100 font-medium">
                          <CheckCircle2 size={12} /> Resolved
                        </div>
                      )}

                      {req.status === 'REJECTED' && (
                        <div className="flex items-center gap-1 text-[10px] text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100 font-medium">
                          <AlertCircle size={12} /> Rejected
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Raise Maintenance Modal */}
      {isRaiseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsRaiseModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Raise Maintenance Request</h3>
            <form onSubmit={handleRaiseSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Asset</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={raiseFormData.assetId}
                  onChange={(e) => setRaiseFormData({ ...raiseFormData, assetId: e.target.value })}
                >
                  <option value="">Choose an asset...</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the issue in detail..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={raiseFormData.issueDescription}
                  onChange={(e) => setRaiseFormData({ ...raiseFormData, issueDescription: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={raiseFormData.priority}
                  onChange={(e) => setRaiseFormData({ ...raiseFormData, priority: e.target.value })}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/asset-photo.jpg"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={raiseFormData.photoUrl}
                  onChange={(e) => setRaiseFormData({ ...raiseFormData, photoUrl: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRaiseModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm text-sm"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Technician Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Assign Technician</h3>
            <p className="text-xs text-gray-500 mb-4">Request for {selectedRequest?.asset?.assetTag}</p>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Technician</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={assignFormData.technicianId}
                  onChange={(e) => setAssignFormData({ ...assignFormData, technicianId: e.target.value })}
                >
                  <option value="">Choose an employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm text-sm"
                >
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
