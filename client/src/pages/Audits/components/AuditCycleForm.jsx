import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { X, AlertCircle, Calendar, Building2, MapPin, CheckCircle2 } from 'lucide-react';

const AuditCycleForm = ({ onClose, onSubmit }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    scopeType: 'DEPARTMENT',
    scopeValue: '',
    dateStart: '',
    dateEnd: '',
  });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [dRes, lRes] = await Promise.all([
          api.get('/departments').catch(() => ({ data: { data: [] } })),
          api.get('/assets?distinct=location').catch(() => ({ data: { data: [] } })),
        ]);
        setDepartments(dRes.data.data || []);
        const locs = [...new Set((lRes.data.data || []).map(a => a.location).filter(Boolean))];
        setLocations(locs);
      } catch (err) {
        console.error('Failed to load references', err);
      }
    };
    loadRefs();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.scopeValue || !form.dateStart || !form.dateEnd) {
      setError('All fields are required');
      return;
    }
    if (new Date(form.dateStart) >= new Date(form.dateEnd)) {
      setError('End date must be after start date');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create audit cycle');
    } finally {
      setLoading(false);
    }
  };

  const scopeOptions = form.scopeType === 'DEPARTMENT'
    ? departments.map(d => ({ value: d.id, label: d.name }))
    : locations.map(l => ({ value: l, label: l }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold text-gray-900 mb-1">Create Audit Cycle</h3>
        <p className="text-sm text-gray-500 mb-6">Define scope, date range, and auto-populate items.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, scopeType: 'DEPARTMENT', scopeValue: '' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border ${
                  form.scopeType === 'DEPARTMENT'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Building2 size={14} /> Department
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, scopeType: 'LOCATION', scopeValue: '' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border ${
                  form.scopeType === 'LOCATION'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MapPin size={14} /> Location
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.scopeType === 'DEPARTMENT' ? 'Department' : 'Location'}
            </label>
            <select
              required
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={form.scopeValue}
              onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
            >
              <option value="">— Select —</option>
              {scopeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={14} className="inline mr-1" /> Start Date
              </label>
              <input
                type="date"
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.dateStart}
                onChange={(e) => setForm({ ...form, dateStart: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={14} className="inline mr-1" /> End Date
              </label>
              <input
                type="date"
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.dateEnd}
                onChange={(e) => setForm({ ...form, dateEnd: e.target.value })}
              />
            </div>
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuditCycleForm;