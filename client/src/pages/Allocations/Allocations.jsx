import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Search,
  ArrowRightLeft,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';
import AllocateModal from './components/AllocateModal';
import ReturnModal from './components/ReturnModal';
import TransferRequestModal from './components/TransferRequestModal';
import ApproveRejectTransferModal from './components/ApproveRejectTransferModal';

const Allocations = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'transfers' | 'history'
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const [allocateModal, setAllocateModal] = useState(null); // asset to allocate
  const [returnModal, setReturnModal] = useState(null);     // allocation to return
  const [transferModal, setTransferModal] = useState(null); // conflicting allocation from 409
  const [approvalModal, setApprovalModal] = useState(null); // transfer to approve/reject

  const [toast, setToast] = useState(null);

  const canManage = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user?.role);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('employeeId', search); // can be replaced with name search
      const res = await api.get(`/allocations?${params.toString()}`);
      setAllocations(res.data.data || []);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to fetch allocations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, showToast]);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/transfers?status=REQUESTED`);
      setTransfers(res.data.data || []);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to fetch transfers');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'active' || activeTab === 'history') {
      fetchAllocations();
    } else if (activeTab === 'transfers') {
      fetchTransfers();
    }
  }, [activeTab, fetchAllocations, fetchTransfers]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAllocateSuccess = (allocation) => {
    showToast('success', `Asset ${allocation?.asset?.assetTag || ''} allocated successfully`);
    fetchAllocations();
    setAllocateModal(null);
  };

  const handleAllocateConflict = (conflictedAsset, errorPayload) => {
    // 409 — show "currently held by X" and offer transfer request
    showToast('error', errorPayload.message || 'Asset is currently held by another holder');
    setTransferModal({
      asset: conflictedAsset,
      conflict: errorPayload.details || errorPayload,
    });
  };

  const handleReturnSuccess = () => {
    showToast('success', 'Asset returned successfully');
    fetchAllocations();
    setReturnModal(null);
  };

  const handleTransferSuccess = () => {
    showToast('success', 'Transfer request submitted');
    setTransferModal(null);
    fetchTransfers();
  };

  const handleApprovalAction = async () => {
    showToast('success', 'Transfer updated');
    fetchTransfers();
    setApprovalModal(null);
  };

  // ── Render helpers ────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const map = {
      ACTIVE: 'bg-blue-100 text-blue-800',
      RETURNED: 'bg-green-100 text-green-800',
      TRANSFERRED: 'bg-purple-100 text-purple-800',
      OVERDUE: 'bg-red-100 text-red-800',
      REQUESTED: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Allocations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage asset assignments, transfers, and returns.
          </p>
        </div>
        {canManage && activeTab === 'active' && (
          <button
            onClick={() => {
              // open empty allocate modal, lets user pick an asset
              setAllocateModal({});
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Allocate Asset
          </button>
        )}
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex space-x-2 w-fit">
        {[
          { id: 'active', name: 'Active', icon: CheckCircle2 },
          { id: 'transfers', name: 'Transfer Requests', icon: ArrowRightLeft },
          { id: 'history', name: 'History', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* ─── Filter Bar ────────────────────────────────────────── */}
      {(activeTab === 'active' || activeTab === 'history') && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search allocations…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="OVERDUE">Overdue</option>
              <option value="RETURNED">Returned</option>
              <option value="TRANSFERRED">Transferred</option>
            </select>
          </div>
          <button
            onClick={fetchAllocations}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}

      {/* ─── Tab Content ────────────────────────────────────────── */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading transfer requests…</div>
          ) : transfers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ArrowRightLeft className="mx-auto mb-3 text-gray-300" size={40} />
              <p className="font-medium">No pending transfer requests</p>
              <p className="text-sm mt-1">Requests appear here when assets get contested.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/30">
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Asset</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">From</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">To</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Requested By</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{t.asset?.assetTag}</div>
                      <div className="text-xs text-gray-500">{t.asset?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {t.fromHolder?.name}
                      <div className="text-xs text-gray-500">{t.fromHolder?.department?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {t.toHolder?.name}
                      <div className="text-xs text-gray-500">{t.toHolder?.department?.name}</div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.requestedBy?.name}</td>
                    <td className="px-6 py-4 text-right">
                      {canManage && t.status === 'REQUESTED' && (
                        <button
                          onClick={() => setApprovalModal(t)}
                          className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(activeTab === 'active' || activeTab === 'history') && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading allocations…</div>
          ) : allocations.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <CheckCircle2 className="mx-auto mb-3 text-gray-300" size={40} />
              <p className="font-medium">No allocations found</p>
              <p className="text-sm mt-1">
                {activeTab === 'active'
                  ? 'Allocate an asset to get started.'
                  : 'Completed allocations will appear here.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/30">
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Asset</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Holder</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Department</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Allocated</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Expected Return</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{a.asset?.assetTag}</div>
                      <div className="text-xs text-gray-500">{a.asset?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {a.employeeHolder?.name || a.departmentHolder?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {a.employeeHolder?.department?.name || a.departmentHolder?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(a.allocatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {a.expectedReturnDate
                        ? new Date(a.expectedReturnDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                    <td className="px-6 py-4 text-right">
                      {(a.status === 'ACTIVE' || a.status === 'OVERDUE') && (
                        <button
                          onClick={() => setReturnModal(a)}
                          className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 font-medium bg-green-50 px-3 py-1.5 rounded-lg"
                        >
                          <RotateCcw size={14} /> Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Modals ─────────────────────────────────────────────── */}
      {allocateModal && (
        <AllocateModal
          prefillAsset={allocateModal.asset}
          onClose={() => setAllocateModal(null)}
          onSuccess={handleAllocateSuccess}
          onConflict={(asset, err) => handleAllocateConflict(asset, err)}
        />
      )}

      {returnModal && (
        <ReturnModal
          allocation={returnModal}
          onClose={() => setReturnModal(null)}
          onSuccess={handleReturnSuccess}
        />
      )}

      {transferModal && (
        <TransferRequestModal
          asset={transferModal.asset}
          conflict={transferModal.conflict}
          onClose={() => setTransferModal(null)}
          onSuccess={handleTransferSuccess}
        />
      )}

      {approvalModal && (
        <ApproveRejectTransferModal
          transfer={approvalModal}
          onClose={() => setApprovalModal(null)}
          onAction={handleApprovalAction}
        />
      )}

      {/* ─── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Allocations;