import React, { useState } from 'react';
import api from '../../../utils/api';
import { X, AlertCircle, Clock } from 'lucide-react';

const RescheduleModal = ({ booking, onClose, onSuccess }) => {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  const toLocal = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    startDateTime: toLocal(start),
    endDateTime: toLocal(end),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.put(`/bookings/${booking.id}/reschedule`, {
        startTime: new Date(form.startDateTime).toISOString(),
        endTime: new Date(form.endDateTime).toISOString(),
      });
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reschedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold text-gray-900 mb-1">Reschedule Booking</h3>
        <p className="text-sm text-gray-500 mb-5">
          <Clock size={14} className="inline mr-1" />
          {booking.asset?.assetTag} — {booking.asset?.name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Start</label>
              <input
                type="datetime-local"
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.startDateTime}
                onChange={(e) => setForm({ ...form, startDateTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New End</label>
              <input
                type="datetime-local"
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.endDateTime}
                onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
            If the new slot is taken, the reschedule will be rolled back entirely.
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
              {loading ? 'Rescheduling…' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RescheduleModal;