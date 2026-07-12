import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

// Simple Animated Counter Component (Beginner friendly)
const GintiWalaCounter = ({ endValue }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let current = 0;
    const increment = endValue > 50 ? Math.ceil(endValue / 20) : 1;
    const timer = setInterval(() => {
      current += increment;
      if (current >= endValue) {
        setCount(endValue);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [endValue]);

  return <span>{count}</span>;
};

const DashboardPage = () => {
  // States
  const [meraData, setMeraData] = useState(null);
  const [overdueItems, setOverdueItems] = useState([]);
  const [trustScore, setTrustScore] = useState(null);
  const [loadingHorahiHai, setLoadingHorahiHai] = useState(true);
  
  // Dummy Role Simulation for 3B.11
  const [meraRole, setMeraRole] = useState('ADMIN'); 

  // Backend se data mangwa rahe hai
  useEffect(() => {
    const dataLaoBhai = async () => {
      try {
        setLoadingHorahiHai(true);
        // Promise.all se sab API ek sath hit karte hai
        const [kpiRes, overdueRes, trustRes] = await Promise.all([
          api.get('/dashboard/kpis'),
          api.get('/dashboard/overdue'),
          api.get('/dashboard/trust-score')
        ]);
        
        setMeraData(kpiRes.data.data);
        setOverdueItems(overdueRes.data.data || []);
        setTrustScore(trustRes.data.data.score);
        
      } catch (error) {
        console.error('Data laane me error ho gaya:', error);
      } finally {
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

  const getBarWidth = (value) => {
    if (totalAssets === 0) return '0%';
    return `${(value / totalAssets) * 100}%`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 mt-4">
      {/* Header and Role Simulator */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">System Dashboard</h1>
          {trustScore !== null && (
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border border-green-200">
              🌟 User Reliability Score: {trustScore}/100
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100">
          <span className="text-sm font-medium text-gray-600">Simulate Role:</span>
          <select 
            value={meraRole} 
            onChange={(e) => setMeraRole(e.target.value)}
            className="text-sm border-gray-300 rounded focus:ring-indigo-500 font-semibold text-indigo-700 outline-none"
          >
            <option value="ADMIN">Admin (Org-wide)</option>
            <option value="DEPT_HEAD">Dept Head (Dept-only)</option>
            <option value="EMPLOYEE">Employee (Own items)</option>
          </select>
        </div>
      </div>

      {/* Smart UI Logic: Agar Employee hai toh usko Overdue pehle dikhao, nahi toh KPIs pehle */}
      {meraRole === 'EMPLOYEE' ? (
        <>
          {/* Overdue Returns (Top Priority for Employee) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 mb-8">
            <div className="flex items-center justify-between border-b pb-2 mb-6">
              <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                ⚠️ My Overdue Returns 
                <span className="bg-red-100 text-red-800 text-xs py-1 px-2 rounded-full">{overdueItems.length}</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              {overdueItems.length === 0 ? (
                <p className="text-gray-500 text-center py-6">Mubarak ho! Tumhara koi asset overdue nahi hai.</p>
              ) : (
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-red-50 text-red-800">
                    <tr>
                      <th className="p-3 rounded-tl-lg">Asset</th>
                      <th className="p-3">Holder</th>
                      <th className="p-3 rounded-tr-lg">Expected Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueItems.map(item => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-red-50 transition">
                        <td className="p-3 font-medium text-gray-800">{item.asset?.name} ({item.asset?.assetTag})</td>
                        <td className="p-3">{item.employeeHolder?.name || 'Unknown'}</td>
                        <td className="p-3 font-semibold text-red-600">
                          {new Date(item.expectedReturnDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-4 mb-8">
            <Link to="/bookings" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-full shadow transition-transform transform hover:scale-105">
              📅 Book Resource
            </Link>
            <button 
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-6 rounded-full shadow transition-transform transform hover:scale-105"
              onClick={() => alert('Maintenance module Dev A banayega! (Phase 4)')}
            >
              🔧 Raise Maintenance
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Quick Action Buttons (3B.11) */}
          <div className="flex flex-wrap gap-4 mb-8">
            <Link to="/assets/register" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-full shadow transition-transform transform hover:scale-105">
              + Register Asset
            </Link>
            <Link to="/bookings" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-full shadow transition-transform transform hover:scale-105">
              📅 Book Resource
            </Link>
            <button 
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-6 rounded-full shadow transition-transform transform hover:scale-105"
              onClick={() => alert('Maintenance module Dev A banayega! (Phase 4)')}
            >
              🔧 Raise Maintenance
            </button>
          </div>
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex flex-col justify-center items-center">
              <span className="text-gray-500 font-semibold mb-1">Total Assets</span>
              <span className="text-4xl font-extrabold text-blue-600">
                <GintiWalaCounter endValue={totalAssets} />
              </span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-500 flex flex-col justify-center items-center">
              <span className="text-gray-500 font-semibold mb-1">Active Bookings</span>
              <span className="text-4xl font-extrabold text-indigo-600">
                 <GintiWalaCounter endValue={totalActiveBookings} />
              </span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500 flex flex-col justify-center items-center">
              <span className="text-gray-500 font-semibold mb-1">Available Assets</span>
              <span className="text-4xl font-extrabold text-green-500">
                 <GintiWalaCounter endValue={assetStatusCounts.AVAILABLE || 0} />
              </span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500 flex flex-col justify-center items-center">
              <span className="text-gray-500 font-semibold mb-1">Under Maintenance</span>
              <span className="text-4xl font-extrabold text-red-500">
                 <GintiWalaCounter endValue={assetStatusCounts.UNDER_MAINTENANCE || 0} />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Basic Bar Chart (Asset Status) */}
            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Status Breakdown</h2>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
                    <span>AVAILABLE</span>
                    <span>{assetStatusCounts.AVAILABLE || 0}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all duration-1000" style={{ width: getBarWidth(assetStatusCounts.AVAILABLE || 0) }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
                    <span>IN USE</span>
                    <span>{assetStatusCounts.IN_USE || 0}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-blue-500 h-3 rounded-full transition-all duration-1000" style={{ width: getBarWidth(assetStatusCounts.IN_USE || 0) }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
                    <span>UNDER MAINTENANCE</span>
                    <span>{assetStatusCounts.UNDER_MAINTENANCE || 0}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-red-500 h-3 rounded-full transition-all duration-1000" style={{ width: getBarWidth(assetStatusCounts.UNDER_MAINTENANCE || 0) }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Overdue Section */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-red-100">
              <div className="flex items-center justify-between border-b pb-2 mb-6">
                <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                  ⚠️ Overdue Returns 
                  <span className="bg-red-100 text-red-800 text-xs py-1 px-2 rounded-full">{overdueItems.length}</span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                {overdueItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">Koi bhi asset overdue nahi hai. Ekdum clean!</p>
                ) : (
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-red-50 text-red-800">
                      <tr>
                        <th className="p-3 rounded-tl-lg">Asset</th>
                        <th className="p-3">Holder</th>
                        <th className="p-3 rounded-tr-lg">Expected Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueItems.map(item => (
                        <tr key={item.id} className="border-b border-gray-50 hover:bg-red-50 transition">
                          <td className="p-3 font-medium text-gray-800">{item.asset?.name} ({item.asset?.assetTag})</td>
                          <td className="p-3">{item.employeeHolder?.name || 'Unknown'}</td>
                          <td className="p-3 font-semibold text-red-600">
                            {new Date(item.expectedReturnDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
