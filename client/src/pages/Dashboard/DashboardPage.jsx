import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const DashboardPage = () => {
  const [meraData, setMeraData] = useState(null);
  const [loadingHorahiHai, setLoadingHorahiHai] = useState(true);

  // Backend se dashboard ka data mangwa rahe hai
  useEffect(() => {
    const dataLaoBhai = async () => {
      try {
        const response = await api.get('/dashboard/kpis');
        setMeraData(response.data.data);
        setLoadingHorahiHai(false);
      } catch (error) {
        console.error('Data laane me error ho gaya:', error);
        setLoadingHorahiHai(false);
      }
    };
    dataLaoBhai();
  }, []);

  if (loadingHorahiHai) {
    return <div className="p-8 text-center text-gray-500 font-bold text-xl">Ruko zara, sabar karo... Loading data!</div>;
  }

  if (!meraData) {
    return <div className="p-8 text-center text-red-500">Kuch gadbad ho gayi data lane me.</div>;
  }

  const { assetStatusCounts, totalActiveBookings } = meraData;
  const totalAssets = Object.values(assetStatusCounts).reduce((a, b) => a + b, 0);

  // Simple CSS width calculation for a basic bar chart look
  const getBarWidth = (value) => {
    if (totalAssets === 0) return '0%';
    return `${(value / totalAssets) * 100}%`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 mt-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">System Dashboard</h1>
      
      {/* Upar ke Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <span className="text-gray-500 font-semibold mb-1">Total Assets</span>
          <span className="text-4xl font-extrabold text-blue-600">{totalAssets}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <span className="text-gray-500 font-semibold mb-1">Active Bookings</span>
          <span className="text-4xl font-extrabold text-indigo-600">{totalActiveBookings}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <span className="text-gray-500 font-semibold mb-1">Available Assets</span>
          <span className="text-4xl font-extrabold text-green-500">{assetStatusCounts.AVAILABLE || 0}</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <span className="text-gray-500 font-semibold mb-1">Under Maintenance</span>
          <span className="text-4xl font-extrabold text-red-500">{assetStatusCounts.UNDER_MAINTENANCE || 0}</span>
        </div>
      </div>

      {/* Basic Bar Chart (Asset Status) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Asset Status Breakdown</h2>
        
        <div className="space-y-4">
          
          {/* Available Bar */}
          <div>
            <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
              <span>AVAILABLE</span>
              <span>{assetStatusCounts.AVAILABLE || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-green-500 h-4 rounded-full transition-all duration-1000" 
                style={{ width: getBarWidth(assetStatusCounts.AVAILABLE || 0) }}
              ></div>
            </div>
          </div>

          {/* In Use Bar */}
          <div>
            <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
              <span>IN USE</span>
              <span>{assetStatusCounts.IN_USE || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-blue-500 h-4 rounded-full transition-all duration-1000" 
                style={{ width: getBarWidth(assetStatusCounts.IN_USE || 0) }}
              ></div>
            </div>
          </div>

          {/* Under Maintenance Bar */}
          <div>
            <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
              <span>UNDER MAINTENANCE</span>
              <span>{assetStatusCounts.UNDER_MAINTENANCE || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-red-500 h-4 rounded-full transition-all duration-1000" 
                style={{ width: getBarWidth(assetStatusCounts.UNDER_MAINTENANCE || 0) }}
              ></div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
