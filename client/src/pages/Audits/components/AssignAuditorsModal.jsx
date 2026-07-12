import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { X, CheckCircle2, UserPlus, Search, AlertCircle } from 'lucide-react';

const AssignAuditorsModal = ({ cycle, onClose, onSubmit }) => {
  const [employees, setEmployees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/employees?limit=200&status=ACTIVE');
        const emps = res.data.data || [];
        setEmployees(emps);
        setFiltered(emps);
      } catch (err) {
        console.error('Failed to load employees', err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!search) {
      setFiltered(employees);
    } else {
      const s = search.toLowerCase();
      setFiltered(employees.filter(e =>
        e.name.toLowerCase().includes(s) ||
        e.email.toLowerCase().includes(s) ||
        e.department?.name?.toLowerCase().includes(s)
      ));
    }
  }, [search, employees]);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Please select at least one auditor');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(cycle.id, selected);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign auditors');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <UserPlus size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Assign Auditors</h3>
            <p className="text-sm text-gray-500">
              Cycle #{cycle.id.slice(0, 8)} — {cycle.scopeType}: {cycle.scopeValue}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Employees</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by name, email, or department…"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50/50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No employees found</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filtered.map(emp => (
                  <li key={emp.id} className="p-3 hover:bg-white transition-colors">
                    <label className="flex items-center gap-3 cursor-pointer w-full">
                      <input
                        type="checkbox"
                        checked={selected.includes(emp.id)}
                        onChange={() => toggle(emp.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{emp.name}</span>
                          <span className="text-xs text-gray-500">{emp.email}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {emp.department?.name || 'No department'} • {emp.role}
                        </div>
                      </div>
                      {selected.includes(emp.id) && (
                        <CheckCircle2 size={18} className="text-blue-600" />
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>{selected.length} auditor{selected.length !== 1 ? 's' : ''} selected</span>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 text-red-700 p-3 text-sm">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selected.length === 0}
              className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              {loading ? 'Assigning…' : 'Assign Auditors'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignAuditorsModal;