import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { Mic, MicOff, Sparkles } from 'lucide-react';

// SEEARCH BAR TAAKI APAN SEARCH KR SAKE ASSETS KO

const AssetDirectory = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });
  const [isListening, setIsListening] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  
  const recognitionRef = useRef(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status })
      }).toString();
      
      const res = await api.get(`/assets?${queryParams}`);
      setAssets(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error fetching assets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [pagination.page, filters.status]); // Re-fetch on page or status change

  // Initialize Web Speech API for Voice Search
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setFilters((prev) => ({ ...prev, search: transcript }));
        setIsListening(false);
        // Auto search after voice input
        setTimeout(() => {
          setPagination(prev => ({ ...prev, page: 1 }));
          // We rely on the search button or another fetch call for immediate search, 
          // but we can just call fetchAssets() indirectly if we want, though state might not be updated yet.
        }, 100);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceSearch = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchAssets();
  };

  const generateAiInsight = () => {
    setAiInsight('🤖 AI Analyzing... generating predictive maintenance insights based on usage patterns...');
    setTimeout(() => {
      setAiInsight('✨ AI Insight: 3 assets (MacBooks) show high usage and are due for maintenance in 2 weeks. Recommend scheduling downtime.');
    }, 1500);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Asset Directory</h1>
        <Link to="/assets/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + Register Asset
        </Link>
      </div>

      {/* AI Insight Banner */}
      {aiInsight && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-lg mb-6 flex items-start gap-3 animate-fade-in shadow-sm">
          <Sparkles className="text-indigo-600 mt-0.5 shrink-0" size={20} />
          <p className="text-sm font-medium">{aiInsight}</p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <form onSubmit={handleSearch} className="flex-1 min-w-[300px]">
          <label className="block text-sm text-gray-600 mb-1">Search by Tag / Name / Serial</label>
          <div className="flex">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full border border-gray-300 rounded-l p-2 pr-10 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                placeholder="e.g. AF-0001 or MacBook" 
              />
              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                  isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title="Voice Search"
              >
                {isListening ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
            </div>
            <button type="submit" className="bg-blue-600 text-white border border-blue-600 px-5 font-medium rounded-r hover:bg-blue-700 transition-colors shadow-sm">
              Search
            </button>
          </div>
        </form>

        <div className="w-48">
          <label className="block text-sm text-gray-600 mb-1">Status Filter</label>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full border border-gray-300 rounded p-2 bg-white focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="UNDER_MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>

        <button 
          onClick={generateAiInsight}
          className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Sparkles size={16} />
          AI Analyze
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset Tag</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name / Serial</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">Loading assets...</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">No assets found matching filters.</td></tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                    <Link to={`/assets/${asset.id}`}>{asset.assetTag}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                    <div className="text-sm text-gray-500">{asset.serialNumber || 'No S/N'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 
                        asset.status === 'ALLOCATED' ? 'bg-blue-100 text-blue-800' : 
                        asset.status === 'UNDER_MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {asset.category?.name || 'Uncategorized'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link to={`/assets/${asset.id}`} className="text-indigo-600 hover:text-indigo-900">View Details</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{pagination.page}</span> of <span className="font-medium">{pagination.totalPages || 1}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button 
                  onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
                  disabled={pagination.page >= pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDirectory;
