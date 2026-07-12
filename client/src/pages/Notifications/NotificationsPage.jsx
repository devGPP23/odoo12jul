import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { io } from 'socket.io-client';

const NotificationsPage = () => {
  const [notificationsData, setNotificationsData] = useState([]);
  const [loadingHorahiHai, setLoadingHorahiHai] = useState(true);

  const notificationsLao = async () => {
    try {
      const response = await api.get('/notifications?limit=50'); // Page me thode zyada late hai
      setNotificationsData(response.data.data);
    } catch (error) {
      console.error('Notifications nahi aa paye', error);
    } finally {
      setLoadingHorahiHai(false);
    }
  };

  useEffect(() => {
    notificationsLao();
    
    // Naya socket connection banaya real-time ke liye
    let nayaSocket = null;
    const connectSocket = async () => {
      try {
        const res = await api.get('/bookings/test/me');
        nayaSocket = io('http://localhost:5000', { query: { userId: res.data.id } });
        
        nayaSocket.on('naya_notification', (data) => {
          // Naya aaye toh usko list me top pe add kardo
          setNotificationsData((purana) => [data, ...purana]);
        });
      } catch (e) {}
    };
    connectSocket();

    return () => {
      if (nayaSocket) nayaSocket.disconnect();
    };
  }, []);

  const readMarkKardo = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      // Local state update kardo fast UI ke liye
      setNotificationsData(notificationsData.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Read fail hua', error);
    }
  };

  const sabReadKardo = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotificationsData(notificationsData.map(n => ({ ...n, read: true })));
    } catch (error) {}
  };

  if (loadingHorahiHai) {
    return <div className="p-8 text-center text-gray-500 font-bold">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 mt-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">My Notifications</h1>
        <button 
          onClick={sabReadKardo}
          className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 font-medium transition"
        >
          Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {notificationsData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Koi naya sandesh nahi hai.</div>
        ) : (
          notificationsData.map(notif => (
            <div 
              key={notif._id} 
              onClick={() => !notif.read && readMarkKardo(notif._id)}
              className={`p-5 flex flex-col gap-1 cursor-pointer transition-colors ${
                notif.read ? 'bg-white' : 'bg-indigo-50 hover:bg-indigo-100'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-sm ${notif.read ? 'text-gray-600' : 'text-indigo-900 font-semibold'}`}>
                  {notif.message}
                </span>
                {!notif.read && <span className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0 mt-1"></span>}
              </div>
              <span className="text-xs text-gray-400">
                {new Date(notif.createdAt).toLocaleString()} • {notif.type}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
