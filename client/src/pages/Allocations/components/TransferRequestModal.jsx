import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import {
  X,
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Package,
  User as UserIcon,
} from 'lucide-react';

const TransferRequestModal = ({ asset, conflict, onClose, onSuccess }) => {
  const { user } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    toHolderId: '',
  });

  const assetTag = asset?.assetTag || '';
  const currentHolder = conflict?.currentHolder || 'Unknown';
  const currentDept = conflict?.department || null;
  const allocatedSince = conflict?.allocatedSince || null;

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await api.get('/employees?limit=100');
        setEmployees(res.data.data || []);
      } catch (err) {
        console.error('Failed loading employees', err);
      }
    };
    loadEmployees();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!asset?.id || !form.toHolderId) {
      setError('Please select a target employee.');
      return;
    }

    // We need fromHolderId from current allocation
    const fromHolderId = conflict?.currentHolderId;

    setLoading(true);
    try {
      const payload = {
        assetId: asset.id,
        toHolderId: form.toHolderId,
      };
      if (fromHolderId) payload.fromHolderId = fromHolderId;

      await api.post('/transfers', payload);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create transfer request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (success) onSuccess?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {!success ? (
          <>
            {/* Header with the key UX detail: "Currently held by Priya" */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="text-amber-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">Asset Currently Held</h3>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>{assetTag}</strong> is currently held by{' '}
                  <strong className="text-amber-700">{currentHolder}</strong>
                  {currentDept && (
                    <span className="text-gray-500"> ({currentDept})</span>
                  )}
                  {allocatedSince && (
                    <span className="text-gray-500">
                      {' '}since {new Date(allocatedSince).toLocaleDateString()}
                    </span>
                  )}
                  .
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  You can request a transfer to move this asset to a new holder.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-3 text-sm">
                <Package size={18} className="text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{asset?.name || assetTag}</p>
                  <p className="text-xs text-gray-500">
                    {asset?.location && `${asset.location} • `}
                    {asset?.condition && `Condition: ${asset.condition}`}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ArrowRightLeft size={14} className="inline mr-1" /> Transfer To (Employee)
                </label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  value={form.toHolderId}
                  onChange={(e) => setForm({ ...form, toHolderId: e.target.value })}
                >
                  <option value="">— Choose target employee —</option>
                  {employees
                    .filter((e) => e.status === 'ACTIVE')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} {e.department?.name ? `(${e.department.name})` : ''}
                      </option>
                    ))}
                </select>
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
                  {loading ? 'Submitting…' : 'Request Transfer'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Transfer Request Submitted</h3>
            <p className="text-sm text-gray-500 mb-4">
              A manager will review and approve/reject the transfer for{' '}
              <strong>{assetTag}</strong>.
            </p>
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferRequestModal;