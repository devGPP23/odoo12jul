import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../../utils/api';
import { DownloadCloud, Activity, Wrench, Building2, CalendarDays } from 'lucide-react';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('utilization');
  
  // Data States
  const [utilizationData, setUtilizationData] = useState({ mostUsed: [], idleAssets: [] });
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [departmentData, setDepartmentData] = useState({ totalSystemAssets: 0, departments: [] });
  const [heatmapData, setHeatmapData] = useState([]);
  
  const [loading, setLoading] = useState(false);

  // Fetch data based on tab
  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  const fetchData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'utilization') {
        const res = await api.get('/reports/utilization');
        setUtilizationData(res.data.data);
      } else if (tab === 'maintenance') {
        const res = await api.get('/reports/maintenance-frequency');
        setMaintenanceData(res.data.data);
      } else if (tab === 'department') {
        const res = await api.get('/reports/department-allocation');
        setDepartmentData(res.data.data);
      } else if (tab === 'heatmap') {
        const res = await api.get('/reports/booking-heatmap');
        setHeatmapData(res.data.data);
      }
    } catch (err) {
      console.error('Data laane me error aya:', err);
    }
    setLoading(false);
  };

  const handleExportCsv = () => {
    // API se direct file download karwane ke liye window.open use kar rahe hai
    window.open(`${api.defaults.baseURL}/reports/export?type=utilization`, '_blank');
  };

  // 1. Utilization Tab UI
  const renderUtilization = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Most Used Assets</h2>
        <button 
          onClick={handleExportCsv}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          <DownloadCloud size={18} />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={utilizationData.mostUsed}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip cursor={{fill: 'transparent'}} />
            <Legend />
            <Bar dataKey="totalUsage" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Total Usage (Bookings + Allocations)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Idle Assets (Dhool Kha Rahe Hai)</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {utilizationData.idleAssets.length === 0 ? (
                <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">Koi idle asset nahi hai!</td></tr>
              ) : (
                utilizationData.idleAssets.map((a, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{a.name}</div>
                      <div className="text-sm text-gray-500">{a.tag}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // 2. Maintenance Frequency Tab UI
  const renderMaintenance = () => (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-800">Maintenance Frequency (Category Wise)</h2>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={maintenanceData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="category" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="totalMaintenanceIssues" fill="#EF4444" radius={[4, 4, 0, 0]} name="Total Kharaabian (Issues)" />
            <Bar dataKey="totalAssets" fill="#9CA3AF" radius={[4, 4, 0, 0]} name="Total Assets in Category" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // 3. Department Allocation Tab UI
  const renderDepartment = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Department Allocations</h2>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold">
          Total System Assets: {departmentData.totalSystemAssets}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={departmentData.departments}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="department" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="totalAllocated" fill="#10B981" radius={[4, 4, 0, 0]} name="Total Allocated Assets" />
            <Bar dataKey="overdueCount" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Overdue Assets (Wapas nahi aaye)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // 4. Booking Heatmap Tab UI (HTML/CSS Grid se)
  const renderHeatmap = () => {
    // Color fade logic: 0 = gray-100, high number = darker indigo
    const getColorClass = (count) => {
      if (count === 0) return 'bg-gray-50 text-transparent';
      if (count < 2) return 'bg-indigo-200 text-indigo-800';
      if (count < 5) return 'bg-indigo-400 text-white';
      return 'bg-indigo-600 text-white';
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <h2 className="text-xl font-bold text-gray-800">Peak Usage Windows (Booking Heatmap)</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          
          <div className="min-w-[800px]">
            {/* Header (Hours) */}
            <div className="flex">
              <div className="w-24 shrink-0 font-bold text-sm text-gray-500 py-2">Day / Hour</div>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex-1 text-center font-medium text-xs text-gray-500 py-2">
                  {i}:00
                </div>
              ))}
            </div>
            
            {/* Grid Rows */}
            {heatmapData.map((dayData, idx) => (
              <div key={idx} className="flex border-t border-gray-100">
                <div className="w-24 shrink-0 font-semibold text-sm text-gray-700 py-2 flex items-center">
                  {dayData.day.substring(0, 3)}
                </div>
                {dayData.hours.map((count, hrIdx) => (
                  <div key={hrIdx} className="flex-1 p-1">
                    <div 
                      className={`h-8 rounded flex items-center justify-center text-xs font-medium transition-colors cursor-pointer hover:ring-2 ring-indigo-300 ${getColorClass(count)}`}
                      title={`${dayData.day} at ${hrIdx}:00 - ${count} Bookings`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>Less Bookings</span>
          <div className="w-4 h-4 rounded bg-indigo-200"></div>
          <div className="w-4 h-4 rounded bg-indigo-400"></div>
          <div className="w-4 h-4 rounded bg-indigo-600"></div>
          <span>More Bookings</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Reports & Analytics</h1>
        <p className="text-gray-500 mt-2">Duniya bhar ka data ek hi jagah par.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-8 w-max">
        <button
          onClick={() => setActiveTab('utilization')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'utilization' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Activity size={18} />
          <span>Utilization</span>
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'maintenance' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Wrench size={18} />
          <span>Maintenance</span>
        </button>
        <button
          onClick={() => setActiveTab('department')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'department' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Building2 size={18} />
          <span>Department</span>
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'heatmap' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <CalendarDays size={18} />
          <span>Booking Heatmap</span>
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="min-h-[500px]">
          {activeTab === 'utilization' && renderUtilization()}
          {activeTab === 'maintenance' && renderMaintenance()}
          {activeTab === 'department' && renderDepartment()}
          {activeTab === 'heatmap' && renderHeatmap()}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
