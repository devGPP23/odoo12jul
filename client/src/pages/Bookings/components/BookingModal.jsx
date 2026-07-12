import React, { useState } from 'react';
import api from '../../../utils/api';
import { X, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const BookingModal = ({ assetId, startTime, onClose, onSuccess, onConflict }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Default to a 1-hour slot from the clicked hour
  const defaultEnd = new Date(new Date(startTime).getTime() + 60 * 60 * 1000);

  const [form, setForm] = useState({
    startDateTime: toLocalISOString(startTime),
    endDateTime: toLocalISOString(defaultEnd),
  });

  function toLocalISOString(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/bookings', {
        assetId,
        startTime: new Date(form.startDateTime).toISOString(),
        endTime: new Date(form.endDateTime).toISOString(),
      });
      setSuccess(res.data.data);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 409 && data?.details?.conflictingBooking) {
        onConflict?.({
          message: data.message,
          conflictingBooking: data.details.conflictingBooking,
        });
        return;
      }
      setError(data?.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (success) onSuccess?.(success);
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

        {!success ? (
          <>
            <h3 className="text-xl font-bold text-gray-900 mb-1">New Booking</h3>
            <p className="text-sm text-gray-500 mb-5">
              <Clock size={14} className="inline mr-1" />
              {new Date(startTime).toLocaleString()}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starts</label>
                  <input
                    type="datetime-local"
                    required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    value={form.startDateTime}
                    onChange={(e) => setForm({ ...form, startDateTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ends</label>
                  <input
                    type="datetime-local"
                    required
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    value={form.endDateTime}
                    onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                Tip: Cancel any conflicting booking (or schedule around it). Adjacent slots
                are fine — back-to-back bookings don't conflict.
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
                  {loading ? 'Booking…' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Booking Confirmed</h3>
            <p className="text-sm text-gray-500 mb-4">
              {success.formattedSlot || 'Your booking'} is set.
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

export default BookingModal;