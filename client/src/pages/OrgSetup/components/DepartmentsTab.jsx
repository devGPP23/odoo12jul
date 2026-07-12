import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { Plus, Edit2, ShieldAlert } from 'lucide-react';

const DepartmentsTab = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', parentDepartmentId: '' });

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/departments', {
        name: formData.name,
        parentDepartmentId: formData.parentDepartmentId || undefined
      });
      setIsModalOpen(false);
      setFormData({ name: '', parentDepartmentId: '' });
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating department');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading departments...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Departments</h2>
          <p className="text-sm text-gray-500 mt-1">Manage organization hierarchy</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Department
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Name</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Parent Dept</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Head</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Status</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {departments.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No departments found.</td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{dept.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{dept.parentDepartment?.name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {dept.headEmployee ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {dept.headEmployee.name.charAt(0)}
                        </div>
                        {dept.headEmployee.name}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      dept.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {dept.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
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
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Department</h3>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Department (Optional)</label>
                <select
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.parentDepartmentId}
                  onChange={(e) => setFormData({ ...formData, parentDepartmentId: e.target.value })}
                >
                  <option value="">None</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
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

export default DepartmentsTab;
