import React, { useState } from 'react';
import api from '../../../utils/api';
import { X, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

const CONDITIONS = [
  { value: 'NEW', label: 'New — as good as new' },
  { value: 'GOOD', label: 'Good — minor wear' },
  { value: 'FAIR', label: 'Fair — visible wear' },
  { value: 'POOR', label: 'Poor — heavy wear' },
  { value: 'DAMAGED', label: 'Damaged — needs repair' },
];

const ReturnModal = ({ allocation, onClose, onSuccess }) => {
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [returnNotes, setReturnNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!allocation) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/allocations/${allocation.id}/return`, {
        returnCondition,
        returnNotes: returnNotes || undefined,
      });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to return allocation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result) onSuccess?.(result);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {!result ? (
          <>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Return Asset</h3>
            <p className="text-sm text-gray-500 mb-5">
              <strong>{allocation.asset?.assetTag}</strong> — {allocation.asset?.name}
              <br />
              Currently with{' '}
              <strong>
                {allocation.employeeHolder?.name || allocation.departmentHolder?.name}
              </strong>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Condition
                </label>
                <div className="space-y-2">
                  {CONDITIONS.map((c) => (
                    <label
                      key={c.value}
                      className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        returnCondition === c.value
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="condition"
                        value={c.value}
                        checked={returnCondition === c.value}
                        onChange={(e) => setReturnCondition(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows="3"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Any conditions, damages, or observations…"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
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
                  className="px-4 py-2 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Returning…' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Return Successful</h3>
            <p className="text-sm text-gray-500 mb-4">
              Asset {result.assetTag} is now available.
            </p>

            {result.suggestMaintenance && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 text-amber-800 p-3 text-sm text-left mb-4">
                <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Damaged condition detected</p>
                  <p>Consider raising a maintenance request for this asset.</p>
                </div>
              </div>
            )}

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

export default ReturnModal;