import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { io } from 'socket.io-client';

const NotificationBell = () => {
  const [ghantiKhuliHai, setGhantiKhuliHai] = useState(false);
  const [mereNotifications, setMereNotifications] = useState([]);
  const [unreadGinti, setUnreadGinti] = useState(0);

  // Backend se notifications mangwane ka function
  const notificationsLao = async () => {
    try {
      const response = await api.get('/notifications?limit=5');
      const data = response.data.data;
      setMereNotifications(data);
      
      // Kitne unread hai unki ginti nikali
      const kitneUnread = data.filter(n => n.read === false).length;
      setUnreadGinti(kitneUnread);
    } catch (error) {
      console.error('Notifications laane me dikkat aayi:', error);
    }
  };

  // Jab component load ho tab ye chalega
  useEffect(() => {
    notificationsLao();
    
    let nayaSocket = null;

    // Test user ID laao taaki notification sahi room mein aayen
    const testUserLao = async () => {
      try {
        const res = await api.get('/bookings/test/me');
        const socketUserId = res.data.id;
        
        nayaSocket = io('http://localhost:5000', {
          query: { userId: socketUserId }
        });

        nayaSocket.on('naya_notification', (data) => {
          console.log('🔔 Naya notification aaya bhai!', data);
          setMereNotifications((puraniList) => [data, ...puraniList].slice(0, 5));
          setUnreadGinti((puraniGinti) => puraniGinti + 1);
        });
      } catch (e) {
        console.error('Test user laane mein dikkat', e);
      }
    };

    testUserLao();

    // Clean up on unmount
    return () => {
      if (nayaSocket) nayaSocket.disconnect();
    };
  }, []);

  // Jab user ghanti pe click kare
  const ghantiDabayi = () => {
    setGhantiKhuliHai(!ghantiKhuliHai);
    if (!ghantiKhuliHai) {
      notificationsLao(); // Dropdown khulte hi fresh data le aao
    }
  };

  // Ek notification ko read mark karna
  const readKardoBhai = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      notificationsLao(); // Refresh
    } catch (error) {
      console.error('Read mark nahi ho paya', error);
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button 
        onClick={ghantiDabayi}
        className="relative p-2 text-white hover:text-indigo-200 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* Unread Badge */}
        {unreadGinti > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {unreadGinti}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {ghantiKhuliHai && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-100 z-50">
          <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
            <h3 className="font-bold text-gray-800 text-sm">Notifications</h3>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {mereNotifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">Koi naya notification nahi hai bhai.</div>
            ) : (
              mereNotifications.map((notif) => (
                <div 
                  key={notif._id} 
                  className={`p-3 border-b text-sm cursor-pointer transition ${notif.read ? 'bg-white text-gray-500' : 'bg-blue-50 text-gray-800 font-medium hover:bg-blue-100'}`}
                  onClick={() => !notif.read && readKardoBhai(notif._id)}
                >
                  <p>{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
