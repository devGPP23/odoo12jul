import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const BookingPage = () => {
  // State for fetching assets (to populate dropdown)
  const [assets, setAssets] = useState([]);
  
  // State for Booking Form
  const [selectedAsset, setSelectedAsset] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  // State for Calendar/Timeline
  const [dayBookings, setDayBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  
  // UI States
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [currentUserId, setCurrentUserId] = useState('');
  
  // Fetch current user ID for testing (so it matches DB foreign keys)
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/bookings/test/me');
        setCurrentUserId(res.data.id);
      } catch (err) {
        console.error('Failed to load test user ID', err);
      }
    };
    fetchMe();
  }, []);
  // Fetch bookable assets on mount
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await api.get('/assets'); // We assume this exists from 1B.1
        // Filter to only bookable assets in frontend for simplicity
        const bookable = res.data.data.filter(a => a.isBookable && a.status !== 'UNDER_MAINTENANCE');
        setAssets(bookable);
        if (bookable.length > 0) setSelectedAsset(bookable[0].id);
      } catch (err) {
        console.error('Failed to load assets', err);
      }
    };
    fetchAssets();
  }, []);

  // Fetch bookings for the selected asset and date
  const fetchDayBookings = async () => {
    if (!selectedAsset || !bookingDate) return;
    setLoadingBookings(true);
    try {
      const res = await api.get(`/bookings?assetId=${selectedAsset}&date=${bookingDate}`);
      setDayBookings(res.data.data);
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchDayBookings();
  }, [selectedAsset, bookingDate]);

  // Handle Form Submit (Create Booking)
  const handleBook = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!startTime || !endTime) {
      setErrorMsg('Please select both start and end times.');
      return;
    }

    try {
      // Combine date and time
      const startDateTime = new Date(`${bookingDate}T${startTime}`);
      const endDateTime = new Date(`${bookingDate}T${endTime}`);

      await api.post('/bookings', {
        assetId: selectedAsset,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString()
      });

      setSuccessMsg('Booking confirmed successfully!');
      setStartTime('');
      setEndTime('');
      fetchDayBookings(); // Refresh timeline
    } catch (err) {
      // Handle 409 Conflict Error from backend (2B.7)
      if (err.response?.status === 409) {
        setErrorMsg(err.response.data.message || 'Time slot conflict.');
      } else {
        setErrorMsg(err.response?.data?.message || 'An error occurred while booking.');
      }
    }
  };

  // Handle Cancel
  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.put(`/bookings/${bookingId}/cancel`);
      setSuccessMsg('Booking cancelled.');
      fetchDayBookings();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to cancel booking.');
    }
  };

  // Render Timeline Bar (Simple visual representation)
  const renderTimeline = () => {
    if (loadingBookings) return <p className="text-gray-500">Loading schedule...</p>;
    if (dayBookings.length === 0) return <p className="text-gray-500">No bookings for this date. Free all day!</p>;

    return (
      <div className="space-y-4">
        {dayBookings.map(b => {
          const sTime = new Date(b.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const eTime = new Date(b.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const isMine = b.bookedById === currentUserId;
          const isCancelled = b.status === 'CANCELLED';

          return (
            <div key={b.id} className={`p-4 rounded-lg border ${isCancelled ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-blue-50 border-blue-200'} flex justify-between items-center`}>
              <div>
                <p className={`font-semibold ${isCancelled ? 'line-through text-gray-500' : 'text-blue-900'}`}>
                  {sTime} - {eTime}
                </p>
                <p className="text-sm text-gray-600">
                  Booked by: <span className="font-medium">{b.bookedBy?.name || 'Unknown'}</span>
                </p>
                <span className="text-xs font-bold text-gray-500 mt-1 inline-block">{b.status}</span>
              </div>
              
              {isMine && !isCancelled && b.status !== 'COMPLETED' && (
                <div className="flex gap-2">
                  {/* Reschedule would typically open a modal, keeping it simple here with Cancel */}
                  <button 
                    onClick={() => handleCancel(b.id)}
                    className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 mt-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Resource Booking</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">New Booking</h2>
          
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm font-medium">
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm font-medium">
              ✅ {successMsg}
            </div>
          )}

          <form onSubmit={handleBook} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource / Asset</label>
              <select 
                value={selectedAsset} 
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input 
                type="date" 
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input 
                  type="time" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input 
                  type="time" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full mt-4 bg-blue-600 text-white font-semibold py-3 rounded-lg shadow hover:bg-blue-700 transition duration-200"
            >
              Confirm Booking
            </button>
          </form>
        </div>

        {/* Right Col: Timeline */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center border-b pb-2 mb-6">
            <h2 className="text-xl font-bold text-gray-800">Schedule</h2>
            <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
              {new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          <div className="min-h-[300px]">
            {renderTimeline()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BookingPage;
