import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Search,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  MapPin,
  Shield,
  ArrowDown,
} from 'lucide-react';
import AuditCycleForm from './components/AuditCycleForm';
import AssignAuditorsModal from './components/AssignAuditorsModal';
import MarkItemModal from './components/MarkItemModal';
import DiscrepancyReportModal from './components/DiscrepancyReportModal';
import CloseCycleModal from './components/CloseCycleModal';

const Audits = () => {
  const { user } = useAuth();
  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role);

  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');

  const [selectedCycle, setSelectedCycle] = useState(null);
  const [cycleItems, setCycleItems] = useState([]);
  const [cyclePagination, setCyclePagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [cycleProgress, setCycleProgress] = useState({ total: 0, verified: 0, missing: 0, damaged: 0, pending: 0 });
  const [cycleItemsLoading, setCycleItemsLoading] = useState(false);

  const [cycleFormOpen, setCycleFormOpen] = useState(false);
  const [assignAuditorsOpen, setAssignAuditorsOpen] = useState(false);
  const [markItemOpen, setMarkItemOpen] = useState(false);
  const [markItemData, setMarkItemData] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [closeCycleOpen, setCloseCycleOpen] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(statusFilter && { status: statusFilter }),
        ...(scopeFilter && { scopeType: scopeFilter }),
      });
      const res = await api.get(`/audit-cycles?${params.toString()}`);
      setCycles(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to load audit cycles');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, scopeFilter, showToast]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const fetchCycleItems = async (cycleId, page = 1) => {
    setCycleItemsLoading(true);
    try {
      const res = await api.get(`/audit-cycles/${cycleId}/items?page=${page}&limit=50`);
      // BUG 5 fix: controller puts items in res.data.data (not res.data.data.items)
      // pagination and progress are top-level siblings of data, not nested inside data
      setCycleItems(res.data.data || []);
      setCyclePagination(res.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
      setCycleProgress(res.data.progress || { total: 0, verified: 0, missing: 0, damaged: 0, pending: 0 });
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to load cycle items');
    } finally {
      setCycleItemsLoading(false);
    }
  };

  const handleOpenCycle = async (cycle) => {
    setSelectedCycle(cycle);
    await fetchCycleItems(cycle.id);
  };

  const handleCreateCycle = async (data) => {
    try {
      const res = await api.post('/audit-cycles', data);
      showToast('success', 'Audit cycle created successfully');
      setCycleFormOpen(false);
      fetchCycles();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to create cycle');
    }
  };

  const handleAssignAuditors = async (cycleId, auditorIds) => {
    try {
      await api.post(`/audit-cycles/${cycleId}/assign-auditors`, { auditorIds });
      showToast('success', 'Auditors assigned');
      setAssignAuditorsOpen(false);
      // Refresh items
      await fetchCycleItems(cycleId);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to assign auditors');
    }
  };

  const handleMarkItem = async (itemId, data) => {
    try {
      // MINOR 1 fix: route is /audit-cycles/items/:id (not /audit-items/:id)
      await api.put(`/audit-cycles/items/${itemId}`, data);
      showToast('success', 'Item marked successfully');
      setMarkItemOpen(false);
      await fetchCycleItems(selectedCycle.id, cyclePagination.page);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to mark item');
    }
  };

  const handleCloseCycle = async (cycleId, forceClose) => {
    try {
      const res = await api.post(`/audit-cycles/${cycleId}/close`, { forceClose });
      showToast('success', 'Audit cycle closed successfully');
      setCloseCycleOpen(false);
      await fetchCycles();
      if (selectedCycle?.id === cycleId) {
        await fetchCycleItems(cycleId);
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to close cycle');
    }
  };

  const handleViewReport = async (cycleId) => {
    try {
      const res = await api.get(`/audit-cycles/${cycleId}/report`);
      setReportData(res.data.data);
      setReportOpen(true);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to load report');
    }
  };

  const StatusBadge = ({ status }) => {
    const map = {
      OPEN: 'bg-yellow-100 text-yellow-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      CLOSED: 'bg-green-100 text-green-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const ResultBadge = ({ result }) => {
    const map = {
      VERIFIED: 'bg-green-100 text-green-800',
      MISSING: 'bg-red-100 text-red-800',
      DAMAGED: 'bg-amber-100 text-amber-800',
    };
    return result ? (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${map[result]}`}>{result}</span>
    ) : (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">Pending</span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audit Cycles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage audit cycles, assignments, and discrepancy tracking.</p>
        </div>
        {isManager && (
          <button
            onClick={() => setCycleFormOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Create Audit Cycle
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by scope value…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onChange={(e) => setScopeFilter(e.target.value)}
            value={scopeFilter}
          />
        </div>
        <div>
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <button
          onClick={fetchCycles}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Cycles Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading audit cycles…</div>
        ) : cycles.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="mx-auto mb-3 text-gray-300" size={48} />
            <p className="font-medium">No audit cycles found</p>
            <p className="text-sm mt-1">Create your first audit cycle to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/30">
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Cycle</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Scope</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Period</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Progress</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Auditors</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenCycle(cycle)}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">#{cycle.id.slice(0, 8)}</div>
                      <div className="text-xs text-gray-500">Created {new Date(cycle.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-1">
                        {cycle.scopeType === 'DEPARTMENT' ? (
                          <FolderOpen size={14} className="text-blue-500" />
                        ) : (
                          <MapPin size={14} className="text-green-500" />
                        )}
                        <span className="font-medium">{cycle.scopeType}</span>
                        <span className="text-gray-400">/</span>
                        <span>{cycle.scopeValue}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" />
                        {new Date(cycle.dateStart).toLocaleDateString()} – {new Date(cycle.dateEnd).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={cycle.status} /></td>
                    <td className="px-6 py-4">
                      {/* MINOR 3 fix: no per-result breakdown in list view. Show status-colored pill + item count */}
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            cycle.status === 'CLOSED' ? 'bg-green-500' :
                            cycle.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                            'bg-yellow-400'
                          }`}
                          style={{ width: cycle.status === 'CLOSED' ? '100%' : cycle.status === 'IN_PROGRESS' ? '50%' : '10%' }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{cycle._count?.items || 0} items</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {cycle.assignments?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {cycle.assignments.slice(0, 3).map((a) => (
                            <span key={a.auditor.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              {a.auditor.name}
                            </span>
                          ))}
                          {cycle.assignments.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              +{cycle.assignments.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        {isManager && cycle.status === 'OPEN' && cycle.assignments?.length === 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAssignAuditorsOpen(true); }}
                            className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded-lg text-sm"
                          >
                            Assign Auditors
                          </button>
                        )}
                        {cycle.status === 'OPEN' && isManager && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // MINOR 2 fix: set selectedCycle before opening modal so cycle prop is never null
                              setSelectedCycle(cycle);
                              setCloseCycleOpen(true);
                            }}
                            className="text-red-600 hover:text-red-800 font-medium bg-red-50 px-3 py-1.5 rounded-lg text-sm"
                          >
                            Close Cycle
                          </button>
                        )}
                        {cycle.status === 'CLOSED' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewReport(cycle.id); }}
                            className="text-green-600 hover:text-green-800 font-medium bg-green-50 px-3 py-1.5 rounded-lg text-sm"
                          >
                            View Report
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} — {pagination.total} cycles
              </p>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  className="p-1 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  className="p-1 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        )}
      </div>

      {/* Cycle Detail View */}
      {selectedCycle && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/30 backdrop-blur-sm" onClick={() => { setSelectedCycle(null); setCycleItems([]); }}>
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] mx-auto my-auto flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">Audit Cycle #{selectedCycle.id.slice(0, 8)}</h2>
                  <StatusBadge status={selectedCycle.status} />
                </div>
                <p className="text-sm text-gray-500">
                  {selectedCycle.scopeType}: {selectedCycle.scopeValue} •
                  {new Date(selectedCycle.dateStart).toLocaleDateString()} – {new Date(selectedCycle.dateEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedCycle.status === 'CLOSED' && (
                  <button
                    onClick={() => handleViewReport(selectedCycle.id)}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
                  >
                    <FileText size={14} /> Discrepancy Report
                  </button>
                )}
                <button
                  onClick={() => { setSelectedCycle(null); setCycleItems([]); }}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{cycleProgress.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{cycleProgress.verified}</div>
                  <div className="text-xs text-gray-500">Verified</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{cycleProgress.missing}</div>
                  <div className="text-xs text-gray-500">Missing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{cycleProgress.damaged}</div>
                  <div className="text-xs text-gray-500">Damaged</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{cycleProgress.pending}</div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto p-5">
              {cycleItemsLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-500">Loading items…</div>
              ) : cycleItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                  <FileText className="mb-3 text-gray-300" size={48} />
                  <p className="font-medium">No items in this cycle</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/30 sticky top-12">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Asset</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Category</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Location</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Auditor</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Result</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Notes</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cycleItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{item.asset?.assetTag}</div>
                            <div className="text-xs text-gray-500">{item.asset?.name}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.asset?.category?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.asset?.location || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.auditor?.name || <span className="text-gray-400 italic">Unassigned</span>}
                          </td>
                          <td className="px-4 py-3"><ResultBadge result={item.result} /></td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{item.notes || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {item.auditorId === user.id && !['ADMIN', 'ASSET_MANAGER'].includes(user.role) && (
                              <button
                                onClick={() => { setMarkItemData(item); setMarkItemOpen(true); }}
                                className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded-lg text-sm"
                              >
                                Mark
                              </button>
                            )}
                            {(['ADMIN', 'ASSET_MANAGER'].includes(user.role)) && (
                              <button
                                onClick={() => { setMarkItemData(item); setMarkItemOpen(true); }}
                                className="text-gray-600 hover:text-gray-800 font-medium bg-gray-50 px-3 py-1.5 rounded-lg text-sm"
                              >
                                Override
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Item Pagination */}
              {cyclePagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {cyclePagination.page} of {cyclePagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={cyclePagination.page === 1}
                      onClick={() => fetchCycleItems(selectedCycle.id, cyclePagination.page - 1)}
                      className="p-1 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      disabled={cyclePagination.page === cyclePagination.totalPages}
                      onClick={() => fetchCycleItems(selectedCycle.id, cyclePagination.page + 1)}
                      className="p-1 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {cycleFormOpen && (
        <AuditCycleForm
          onClose={() => setCycleFormOpen(false)}
          onSubmit={handleCreateCycle}
        />
      )}

      {assignAuditorsOpen && (
        <AssignAuditorsModal
          cycle={selectedCycle}
          onClose={() => setAssignAuditorsOpen(false)}
          onSubmit={handleAssignAuditors}
        />
      )}

      {markItemOpen && markItemData && (
        <MarkItemModal
          item={markItemData}
          onClose={() => { setMarkItemOpen(false); setMarkItemData(null); }}
          onSubmit={(data) => handleMarkItem(markItemData.id, data)}
        />
      )}

      {reportOpen && reportData && (
        <DiscrepancyReportModal
          report={reportData}
          onClose={() => { setReportOpen(false); setReportData(null); }}
        />
      )}

      {closeCycleOpen && (
        <CloseCycleModal
          cycle={selectedCycle}
          onClose={() => setCloseCycleOpen(false)}
          onConfirm={(forceClose) => handleCloseCycle(selectedCycle.id, forceClose)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Audits;