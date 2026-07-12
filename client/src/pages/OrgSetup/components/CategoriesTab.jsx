import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { Plus } from 'lucide-react';

const CategoriesTab = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', customFields: '' });

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let parsedCustomFields = {};
      if (formData.customFields) {
        try {
          parsedCustomFields = JSON.parse(formData.customFields);
        } catch (e) {
          alert('Custom fields must be valid JSON');
          return;
        }
      }

      await api.post('/categories', {
        name: formData.name,
        customFields: parsedCustomFields
      });
      setIsModalOpen(false);
      setFormData({ name: '', customFields: '' });
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating category');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading categories...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Asset Categories</h2>
          <p className="text-sm text-gray-500 mt-1">Define asset types and metadata schemas</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Category Name</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Asset Count</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Custom Fields (Keys)</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No categories found.</td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <span className="bg-blue-50 text-blue-700 py-1 px-2.5 rounded-lg text-xs font-semibold">
                      {cat._count?.assets || 0} Assets
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                    {cat.customFields ? Object.keys(cat.customFields).join(', ') || '{}' : '{}'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Category</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Fields (JSON)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  rows="3"
                  placeholder='{"processor": "string", "ram": "number"}'
                  value={formData.customFields}
                  onChange={(e) => setFormData({ ...formData, customFields: e.target.value })}
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">Optional. Provide valid JSON schema for dynamic fields.</p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesTab;
