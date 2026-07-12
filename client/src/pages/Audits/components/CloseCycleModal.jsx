import React, { useState } from 'react';
import { X, AlertCircle, AlertTriangle, Shield } from 'lucide-react';

const CloseCycleModal = ({ cycle, onClose, onConfirm }) => {
  const [forceClose, setForceClose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // BUG 2 fix: call real onConfirm prop instead of placeholder
      // BUG 3 fix: pass forceClose value (checkbox no longer required)
      await onConfirm(forceClose);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close cycle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Shield size={24} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Close Audit Cycle</h3>
            <p className="text-sm text-gray-500 mt-1">
              <strong>{cycle?.scopeType} — {cycle?.scopeValue}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm text-amber-800">
                <p className="font-medium">Warning: This action is irreversible (AU4).</p>
                <p className="mt-1">
                  Any pending items will be marked as <strong>MISSING</strong> and their
                  assets transitioned to <strong>LOST</strong> only if you enable force-close.
                </p>
              </div>
            </div>
          </div>

          {/* BUG 3 fix: removed `required` — normal close (no pending items) must be possible */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={forceClose}
                onChange={e => setForceClose(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 block">
                  Force-close (mark all pending items as MISSING → LOST)
                </span>
                <span className="text-xs text-gray-500">
                  Leave unchecked if all items are already marked.
                </span>
              </div>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 text-red-700 p-3 text-sm">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              {loading ? 'Closing…' : forceClose ? 'Force Close Cycle' : 'Close Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CloseCycleModal;