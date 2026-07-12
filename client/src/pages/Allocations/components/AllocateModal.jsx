import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { X, AlertCircle, Package, User as UserIcon, Building, Search } from 'lucide-react';

const AllocateModal = ({ prefillAsset = null, onClose, onSuccess, onConflict }) => {
  const { user } = useAuth();
  const canManageRoles = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user?.role);

  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [assetQuery, setAssetQuery] = useState('');
  const [form, setForm] = useState({
    assetId: prefillAsset?.id || '',
    assetTag: prefillAsset?.assetTag || '',
    holderType: 'employee', // 'employee' | 'department'
    employeeHolderId: '',
    departmentHolderId: '',
    expectedReturnDate: '',
    idempotencyKey: '',
  });

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [aRes, eRes, dRes] = await Promise.all([
          api.get('/assets?limit=100').catch(() => ({ data: { data: [] } })),
          api.get('/employees?limit=100').catch(() => ({ data: { data: [] } })),
          api.get('/departments').catch(() => ({ data: { data: [] } })),
        ]);
        setAssets(aRes.data.data || []);
        setEmployees(eRes.data.data || []);
        setDepartments(dRes.data.data || []);
      } catch (err) {
        console.error('Failed loading reference data', err);
      }
    };
    loadRefs();
  }, []);

  const filteredAssets = assets.filter(
    (a) =>
      a.status === 'AVAILABLE' &&
      (a.assetTag?.toLowerCase().includes(assetQuery.toLowerCase()) ||
        a.name?.toLowerCase().includes(assetQuery.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.assetId) {
      setError('Please select an asset.');
      return;
    }
    if (form.holderType === 'employee' && !form.employeeHolderId) {
      setError('Please select an employee holder.');
      return;
    }
    if (form.holderType === 'department' && !form.departmentHolderId) {
      setError('Please select a department holder.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        assetId: form.assetId,
        expectedReturnDate: form.expectedReturnDate || undefined,
        idempotencyKey: form.idempotencyKey || undefined,
      };
      if (form.holderType === 'employee') {
        payload.employeeHolderId = form.employeeHolderId;
      } else {
        payload.departmentHolderId = form.departmentHolderId;
      }

      const res = await api.post('/allocations', payload);
      onSuccess?.(res.data.data);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      // 409 conflict key UX
      if (status === 409 && onConflict && data?.message) {
        const asset = assets.find((a) => a.id === form.assetId);
        onConflict(asset || { id: form.assetId, assetTag: form.assetTag }, {
          message: data.message,
          details: data.details,
        });
        onClose?.();
        return;
      }
      setError(data?.message || 'Failed to allocate asset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold text-gray-900 mb-1">Allocate Asset</h3>
        <p className="text-sm text-gray-500 mb-6">
          Assign an asset to an employee or department.
        </p>

        {!canManageRoles && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
            You can submit allocations but manager approval will be required.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Asset selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Package size={14} className="inline mr-1" /> Asset
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search by tag or name…"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                value={assetQuery}
                onChange={(e) => setAssetQuery(e.target.value)}
              />
            </div>
            <select
              required
              className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={form.assetId}
              onChange={(e) => {
                const a = assets.find((x) => x.id === e.target.value);
                setForm({ ...form, assetId: e.target.value, assetTag: a?.assetTag || '' });
              }}
            >
              <option value="">— Choose an asset —</option>
              {filteredAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetTag} — {a.name} ({a.status})
                </option>
              ))}
            </select>
            {assets.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                No assets available — Phase 1B (asset registration) may not be implemented yet.
              </p>
            )}
          </div>

          {/* Holder type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Holder Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, holderType: 'employee' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border ${
                  form.holderType === 'employee'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <UserIcon size={14} /> Employee
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, holderType: 'department' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border ${
                  form.holderType === 'department'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Building size={14} /> Department
              </button>
            </div>
          </div>

          {form.holderType === 'employee' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.employeeHolderId}
                onChange={(e) => setForm({ ...form, employeeHolderId: e.target.value })}
              >
                <option value="">— Choose an employee —</option>
                {employees
                  .filter((e) => e.status === 'ACTIVE')
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.department?.name ? `(${e.department.name})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.departmentHolderId}
                onChange={(e) => setForm({ ...form, departmentHolderId: e.target.value })}
              >
                <option value="">— Choose a department —</option>
                {departments
                  .filter((d) => d.status === 'ACTIVE')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Return Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.expectedReturnDate}
                onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Idempotency Key (optional)
              </label>
              <input
                type="text"
                placeholder="uuid or unique token"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.idempotencyKey}
                onChange={(e) => setForm({ ...form, idempotencyKey: e.target.value })}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 text-red-700 p-3 text-sm">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              {loading ? 'Allocating…' : 'Allocate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AllocateModal;