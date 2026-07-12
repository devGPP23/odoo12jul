import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Check } from 'lucide-react';

const MarkItemModal = ({ item, onClose, onSubmit }) => {
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!result) {
      setError('Please select a result');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ result, notes: notes || undefined });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark item');
    } finally {
      setLoading(false);
    }
  };

  const options = [
    { value: 'VERIFIED', label: 'Verified — Asset found in correct condition', icon: <CheckCircle2 size={18} className="text-green-600" /> },
    { value: 'MISSING', label: 'Missing — Asset cannot be located (will be marked LOST on cycle close)', icon: <AlertCircle size={18} className="text-red-600" /> },
    { value: 'DAMAGED', label: 'Damaged — Asset found but in damaged condition', icon: <AlertTriangle size={18} className="text-amber-600" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold text-gray-900 mb-1">Mark Audit Item</h3>
        <p className="text-sm text-gray-500 mb-5">
          <strong>{item.asset?.assetTag}</strong> — {item.asset?.name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Result</label>
            <div className="space-y-2">
              {options.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    result === opt.value
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="result"
                    value={opt.value}
                    checked={result === opt.value}
                    onChange={e => { setResult(e.target.value); setError(null); }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2 text-sm text-gray-700 flex-1">
                    <span className="w-6 h-6 flex-shrink-0">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              rows="3"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Any observations, location details, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
              disabled={loading || !result}
              className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarkItemModal;