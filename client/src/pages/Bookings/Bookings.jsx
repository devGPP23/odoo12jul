import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  Plus,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Timer,
  Search,
} from 'lucide-react';
import BookingModal from './components/BookingModal';
import RescheduleModal from './components/RescheduleModal';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am – 7pm

const Bookings = () => {
  const { user } = useAuth();
  const [bookableAssets, setBookableAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bookingModal, setBookingModal] = useState(null); // { assetId, date, hour }
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Load bookable assets on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/assets?isBookable=true&limit=100');
        const data = res.data?.data || [];
        setBookableAssets(data);
        if (data[0]) setSelectedAsset(data[0].id);
      } catch (err) {
        // Phase 1B asset registration might not exist yet — show a soft warning
        setError(
          'Could not load bookable assets. Phase 1B (asset registration) may not be implemented yet.'
        );
      }
    };
    load();
  }, []);

  // Load calendar when asset or date changes
  const fetchCalendar = useCallback(async () => {
    if (!selectedAsset) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/bookings/calendar?assetId=${selectedAsset}&date=${date}`
      );
      setBookings(res.data?.data?.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load calendar');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAsset, date]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Build a lookup: { startMs → booking }
  const bookingByStartMs = {};
  bookings.forEach((b) => {
    bookingByStartMs[new Date(b.startTime).getTime()] = b;
  });

  const cellBooking = (hour) => {
    const cellStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
    return bookings.find(
      (b) =>
        new Date(b.startTime).getTime() === cellStart.getTime() &&
        b.status !== 'CANCELLED'
    );
  };

  const handleNewBooking = (hour) => {
    if (!selectedAsset) return;
    setBookingModal({
      assetId: selectedAsset,
      date,
      startTime: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`),
    });
  };

  const handleBookingSuccess = (booking) => {
    showToast('success', 'Booking created');
    setBookingModal(null);
    fetchCalendar();
  };

  const handleBookingConflict = (err) => {
    const msg = err?.message || 'Booking conflict';
    const conflict = err?.conflictingBooking;
    setBookingModal(null);
    showToast(
      'error',
      conflict
        ? `Conflicts with ${conflict.bookedBy}'s booking ${conflict.formattedTime}`
        : msg
    );
  };

  const handleReschedule = (booking) => {
    setRescheduleModal(booking);
  };

  const handleCancel = async (booking) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await api.put(`/bookings/${booking.id}/cancel`);
      showToast('success', 'Booking cancelled');
      fetchCalendar();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleRescheduleSuccess = () => {
    showToast('success', 'Booking rescheduled');
    setRescheduleModal(null);
    fetchCalendar();
  };

  const statusColor = (status) => {
    const map = {
      UPCOMING: 'border-blue-300 bg-blue-50 text-blue-800',
      ONGOING: 'border-green-400 bg-green-50 text-green-800',
      COMPLETED: 'border-gray-300 bg-gray-50 text-gray-700',
      CANCELLED: 'border-gray-300 bg-gray-100 text-gray-500 line-through',
    };
    return map[status] || map.UPCOMING;
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Resource Bookings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Schedule bookable assets like rooms or projectors.
          </p>
        </div>
      </div>

      {/* ─── Filter Bar ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Resource</label>
          <select
            value={selectedAsset || ''}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            {bookableAssets.length === 0 && <option value="">No bookable assets</option>}
            {bookableAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetTag} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={fetchCalendar}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 text-amber-800 p-3 text-sm">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Calendar Grid ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Calendar size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading bookings…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/30">
                  <th className="px-4 py-3 text-sm font-medium text-gray-500 w-24">Time</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Booking</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">By</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {HOURS.map((hour) => {
                  const booking = cellBooking(hour);
                  const cellStart = new Date(
                    `${date}T${String(hour).padStart(2, '0')}:00:00`
                  );
                  const isPast = cellStart < new Date();

                  return (
                    <tr key={hour} className="hover:bg-gray-50/30">
                      <td className="px-4 py-3 text-sm font-mono text-gray-500 align-top">
                        {String(hour).padStart(2, '0')}:00
                      </td>
                      <td className="px-4 py-3">
                        {!booking ? (
                          !isPast && (
                            <button
                              onClick={() => handleNewBooking(hour)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              <Plus size={14} /> Book this slot
                            </button>
                          )
                        ) : (
                          <div
                            className={`inline-flex flex-col px-3 py-2 rounded-lg border ${statusColor(
                              booking.status
                            )}`}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Timer size={14} />
                              {booking.formattedSlot || `${hour}:00–${hour + 1}:00`}
                            </div>
                            <span className="text-xs">{booking.status}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {booking?.bookedBy?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {booking &&
                          booking.status !== 'CANCELLED' &&
                          booking.status !== 'COMPLETED' &&
                          (booking.bookedById === user?.id ||
                            ['ADMIN', 'ASSET_MANAGER'].includes(user?.role)) && (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleReschedule(booking)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancel(booking)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Legend ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 flex-wrap text-xs">
        <span className="font-medium text-gray-700">Legend:</span>
        <span className="px-2 py-1 rounded border border-blue-300 bg-blue-50 text-blue-800">
          UPCOMING
        </span>
        <span className="px-2 py-1 rounded border border-green-400 bg-green-50 text-green-800">
          ONGOING
        </span>
        <span className="px-2 py-1 rounded border border-gray-300 bg-gray-50 text-gray-700">
          COMPLETED
        </span>
        <span className="px-2 py-1 rounded border border-gray-300 bg-gray-100 text-gray-500 line-through">
          CANCELLED
        </span>
      </div>

      {/* ─── Modals ───────────────────────────────────────────── */}
      {bookingModal && (
        <BookingModal
          {...bookingModal}
          onClose={() => setBookingModal(null)}
          onSuccess={handleBookingSuccess}
          onConflict={handleBookingConflict}
        />
      )}

      {rescheduleModal && (
        <RescheduleModal
          booking={rescheduleModal}
          onClose={() => setRescheduleModal(null)}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* ─── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default Bookings;