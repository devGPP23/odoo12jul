import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { Search, Filter, Shield, ChevronLeft, ChevronRight } from 'lucide-react';

const EmployeesTab = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [promotingId, setPromotingId] = useState(null);

  const fetchEmployees = async (page = 1) => {
    try {
      const res = await api.get(`/employees?page=${page}&limit=${pagination.limit}&name=${search}`);
      setEmployees(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(pagination.page);
  }, [pagination.page, search]);

  const handlePromote = async (employeeId, newRole) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      await api.post(`/employees/${employeeId}/promote`, { role: newRole });
      fetchEmployees(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating role');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading directory...</div>;

  const roleColors = {
    ADMIN: 'bg-purple-100 text-purple-800',
    ASSET_MANAGER: 'bg-blue-100 text-blue-800',
    DEPT_HEAD: 'bg-green-100 text-green-800',
    EMPLOYEE: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Employee Directory</h2>
          <p className="text-sm text-gray-500 mt-1">Manage users and assign roles</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
            <Filter size={16} /> Filter
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Employee</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Department</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Role</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">Status</th>
              {user?.role === 'ADMIN' && (
                <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No employees found.</td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                        <div className="text-xs text-gray-500">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {emp.department?.name || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColors[emp.role]}`}>
                      {emp.role === 'ADMIN' && <Shield size={12} />}
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  {user?.role === 'ADMIN' && (
                    <td className="px-6 py-4 text-right text-sm">
                      {promotingId === emp.id ? (
                        <select
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                          value={emp.role}
                          onChange={(e) => {
                            handlePromote(emp.id, e.target.value);
                            setPromotingId(null);
                          }}
                          onBlur={() => setPromotingId(null)}
                          autoFocus
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="ASSET_MANAGER">ASSET_MANAGER</option>
                          <option value="DEPT_HEAD">DEPT_HEAD</option>
                          <option value="EMPLOYEE">EMPLOYEE</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => setPromotingId(emp.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          Change Role
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="p-1 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="p-1 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesTab;
