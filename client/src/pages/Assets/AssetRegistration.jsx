import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const AssetRegistration = () => {
  const [formData, setFormData] = useState({
    name: '',
    serialNumber: '',
    categoryId: '',
    departmentId: '',
    condition: 'NEW',
    location: '',
    isBookable: false,
    photo: null
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { 
    api.get('/categories').then(res => setCategories(res.data.data)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, photo: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      // If photo upload (1B.3) was ready, we'd upload it first, get URL, then send.
      // For now, sending basic data to register (1B.1)
      const res = await api.post('/assets', {
        ...formData,
        photo: undefined // stripping file object for basic JSON request
      });
      setMessage(`Success! Asset Registered with Tag: ${res.data.data.assetTag}`);
      // Reset form
      setFormData({
        name: '', serialNumber: '', categoryId: '', departmentId: '',
        condition: 'NEW', location: '', isBookable: false, photo: null
      });
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Register New Asset</h2>
      
      {message && (
        <div className={`p-4 mb-6 rounded ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name</label>
            <input type="text" name="name" required value={formData.name} onChange={handleChange} 
                   className="w-full border border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
            <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleChange} 
                   className="w-full border border-gray-300 rounded p-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select name="categoryId" value={formData.categoryId} onChange={handleChange}
                    className="w-full border border-gray-300 rounded p-2 bg-white">
              <option value="">Select Category (Optional)</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select name="condition" value={formData.condition} onChange={handleChange}
                    className="w-full border border-gray-300 rounded p-2 bg-white">
              <option value="NEW">New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input type="text" name="location" value={formData.location} onChange={handleChange} 
                 className="w-full border border-gray-300 rounded p-2" placeholder="e.g. IT Room, 2nd Floor" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asset Photo</label>
          <input type="file" accept="image/*" onChange={handleFileChange} 
                 className="w-full border border-gray-300 rounded p-2 bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>

        <div className="flex items-center">
          <input type="checkbox" id="isBookable" name="isBookable" checked={formData.isBookable} onChange={handleChange} 
                 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
          <label htmlFor="isBookable" className="ml-2 block text-sm text-gray-900">
            This asset is bookable (like a Meeting Room or Projector)
          </label>
        </div>

        <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? 'Registering...' : 'Register Asset'}
        </button>
      </form>
    </div>
  );
};

export default AssetRegistration;
