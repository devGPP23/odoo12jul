import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';

// FRONTEND PE SARE ASSETS DIKH JAYENGE 
const AssetDetail = () => {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAssetData = async () => {
      try {
        setLoading(true);
        // Fetch asset details 
        const assetRes = await api.get(`/assets/${id}`);
        setAsset(assetRes.data.data);

        // Fetch asset history 
        const historyRes = await api.get(`/assets/${id}/history`);
        setHistory(historyRes.data.data);
      } catch (err) {
        setError('Failed to load asset data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssetData();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-600">Loading asset details...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!asset) return <div className="p-8 text-center text-gray-600">Asset not found.</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 mt-6">
      
      {/* Header Section */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-lg shadow">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-800">{asset.name}</h1>
            <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full 
              ${asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 
                asset.status === 'ALLOCATED' ? 'bg-blue-100 text-blue-800' : 
                asset.status === 'UNDER_MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-gray-100 text-gray-800'}`}>
              {asset.status}
            </span>
          </div>
          <p className="text-gray-500 font-medium">Tag: {asset.assetTag} | S/N: {asset.serialNumber || 'N/A'}</p>
        </div>
        <div className="mt-4 md:mt-0 space-x-2">
          {/* Future Dev A / Dev B integration points */}
          {asset.status === 'AVAILABLE' && (
            <button className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">Allocate</button>
          )}
          {asset.status !== 'UNDER_MAINTENANCE' && (
            <button className="bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600">Report Issue</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Info Card */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow self-start">
          <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Details</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className="font-medium text-gray-900">{asset.category?.name || 'Uncategorized'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Condition</p>
              <p className="font-medium text-gray-900">{asset.condition}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Location</p>
              <p className="font-medium text-gray-900">{asset.location || 'Not Specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Is Bookable</p>
              <p className="font-medium text-gray-900">{asset.isBookable ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>

        {/* History Timeline */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">Lifecycle History</h2>
          
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No history recorded for this asset yet.</p>
          ) : (
            <div className="relative border-l border-gray-200 ml-3">
              {history.map((record, index) => (
                <div key={`${record.type}-${record.id}-${index}`} className="mb-8 ml-6">
                  {/* Timeline Dot */}
                  <span className={`absolute flex items-center justify-center w-6 h-6 rounded-full -left-3 ring-8 ring-white
                    ${record.type === 'ALLOCATION' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      {record.type === 'ALLOCATION' 
                        ? <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                        : <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path>
                      }
                    </svg>
                  </span>
                  
                  <div className="p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-md font-semibold text-gray-900">
                        {record.type === 'ALLOCATION' ? 'Asset Allocated' : 'Maintenance Requested'}
                      </h3>
                      <time className="text-sm font-normal text-gray-500">
                        {new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </time>
                    </div>
                    <p className="text-sm text-gray-600 font-medium mb-2">{record.details}</p>
                    <p className="text-xs text-gray-500">Status: {record.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AssetDetail;
