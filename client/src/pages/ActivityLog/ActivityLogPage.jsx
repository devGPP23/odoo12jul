import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const ActivityLogPage = () => {
  const [activities, setActivities] = useState([]);
  const [loadingHorahiHai, setLoadingHorahiHai] = useState(true);
  const [filterAction, setFilterAction] = useState('');

  const dataLao = async () => {
    try {
      setLoadingHorahiHai(true);
      // Agar filter hai toh url query mein bhejenge
      let url = '/activity-logs?limit=30';
      if (filterAction) url += `&action=${filterAction}`;
      
      const response = await api.get(url);
      setActivities(response.data.data);
    } catch (error) {
      console.error('Activity logs fail', error);
    } finally {
      setLoadingHorahiHai(false);
    }
  };

  useEffect(() => {
    dataLao();
  }, [filterAction]);

  return (
    <div className="max-w-6xl mx-auto p-6 mt-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Activity Log</h1>
        
        {/* Filter Dropdown */}
        <select 
          value={filterAction} 
          onChange={(e) => setFilterAction(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Actions</option>
          <option value="CREATED">Created</option>
          <option value="UPDATED">Updated</option>
          <option value="DELETED">Deleted</option>
          <option value="LOGIN">Login</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loadingHorahiHai ? (
          <div className="p-8 text-center text-gray-500">Log la rahe hain...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Koi log nahi mila.</div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-800 border-b">
              <tr>
                <th className="p-4">Action</th>
                <th className="p-4">User</th>
                <th className="p-4">Entity Type</th>
                <th className="p-4">Details</th>
                <th className="p-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.action === 'CREATED' ? 'bg-green-100 text-green-700' :
                      log.action === 'DELETED' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-gray-800">{log.userEmail || log.userId}</td>
                  <td className="p-4">{log.entityType}</td>
                  <td className="p-4 text-xs text-gray-500 max-w-xs truncate">
                    {JSON.stringify(log.changes || log.details)}
                  </td>
                  <td className="p-4 text-right text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ActivityLogPage;
