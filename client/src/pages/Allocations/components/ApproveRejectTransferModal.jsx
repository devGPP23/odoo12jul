import React, { useState } from 'react';
import api from '../../../utils/api';
import {
  X,
  AlertCircle,
  Check,
  XCircle,
  ArrowRightLeft,
  Package,
} from 'lucide-react';

const ApproveRejectTransferModal = ({ transfer, onClose, onAction }) => {
  const [decision, setDecision] = useState(null); // 'approve' | 'reject'
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  if (!transfer) return null;

  const handleAction = async (action) => {
    if (!action) return;
    setLoading(true);
    setError(null);
    try {
      if (action === 'approve') {
        await api.put(`/transfers/${transfer.id}/approve`);
      } else if (action === 'reject') {
        await api.put(`/transfers/${transfer.id}/reject`, {
          rejectionReason: reason || undefined,
        });
      }
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} transfer`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (done) onAction?.();
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

        {!done ? (
          <>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <ArrowRightLeft className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Review Transfer</h3>
                <p className="text-sm text-gray-500">
                  Approving will atomically swap the asset holder.
                </p>
              </div>
            </div>

            {/* Asset summary */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-3 text-sm">
                <Package size={18} className="text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {transfer.asset?.assetTag} — {transfer.asset?.name}
                  </p>
                </div>
              </div>
            </div>

            {/* From → To */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 bg-red-50 rounded-xl">
                <p className="text-xs uppercase tracking-wide text-red-600 font-semibold mb-1">
                  From (Current)
                </p>
                <p className="font-medium text-gray-900">
                  {transfer.fromHolder?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {transfer.fromHolder?.department?.name}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-xs uppercase tracking-wide text-green-600 font-semibold mb-1">
                  To (Requested)
                </p>
                <p className="font-medium text-gray-900">
                  {transfer.toHolder?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {transfer.toHolder?.department?.name}
                </p>
              </div>
            </div>

            {decision === 'reject' && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason (optional)
                </label>
                <textarea
                  rows="2"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Why is this transfer rejected?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-4">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!decision ? (
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setDecision('reject')}
                  className="px-4 py-2 bg-red-50 text-red-700 font-medium hover:bg-red-100 rounded-xl flex items-center gap-1"
                >
                  <XCircle size={14} /> Reject
                </button>
                <button
                  onClick={() => setDecision('approve')}
                  className="px-4 py-2 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl shadow-sm flex items-center gap-1"
                >
                  <Check size={14} /> Approve
                </button>
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDecision(null)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={() => handleAction(decision)}
                  disabled={loading}
                  className={`px-4 py-2 font-medium rounded-xl shadow-sm disabled:opacity-50 ${
                    decision === 'approve'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {loading ? 'Processing…' : `Confirm ${decision === 'approve' ? 'Approve' : 'Reject'}`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={28} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Transfer Updated</h3>
            <p className="text-sm text-gray-500 mb-4">
              The transfer request has been processed.
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

export default ApproveRejectTransferModal;