import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowDown, AlertCircle } from 'lucide-react';

/**
 * BUG 4 fix: API (getDiscrepancyReport) returns:
 *   { cycleId, scopeType, scopeValue, totalDiscrepancies, missing, damaged, items[] }
 * Previous code incorrectly read report.cycle.id, report.discrepancies, report.verified — all undefined.
 */
const DiscrepancyReportModal = ({ report, onClose }) => {
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const headers = [
        'Asset Tag', 'Asset Name', 'Category', 'Location',
        'Condition', 'Result', 'Flagged By', 'Notes', 'Flagged At',
      ];
      const rows = (report.items || []).map(item => [
        item.assetTag,
        item.assetName,
        item.category || '',
        item.location || '',
        item.assetCondition || '',
        item.result,
        item.flaggedBy,
        item.notes || '',
        item.flaggedAt ? new Date(item.flaggedAt).toLocaleString() : '',
      ]);
      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      // BUG 4 fix: was report.cycle.id (undefined) — now report.cycleId
      link.download = `audit-discrepancy-report-${report.cycleId?.slice(0, 8) || 'export'}.csv`;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const StatusIcon = ({ result }) => {
    if (result === 'MISSING') return <AlertCircle size={16} className="text-red-600" />;
    if (result === 'DAMAGED') return <AlertTriangle size={16} className="text-amber-600" />;
    return <CheckCircle2 size={16} className="text-green-600" />;
  };

  // BUG 4 fix: use report.items (not report.discrepancies)
  const discrepancyItems = report.items || [];
  // verified count = total items minus discrepancies (not returned by report endpoint, derive it)
  const verifiedCount = (report.totalDiscrepancies != null)
    ? undefined  // report endpoint only returns discrepancy items, not total verified
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] shadow-2xl flex flex-col relative">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Discrepancy Report</h2>
            {/* BUG 4 fix: was report.cycle.id / report.cycle.scopeType (undefined) */}
            <p className="text-sm text-gray-500">
              Cycle #{report.cycleId?.slice(0, 8)} • {report.scopeType}: {report.scopeValue}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowDown size={14} /> Export CSV
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Summary Cards */}
          {/* BUG 4 fix: report.discrepancies.length → report.totalDiscrepancies */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-700">{report.totalDiscrepancies ?? discrepancyItems.length}</div>
              <div className="text-xs text-gray-500">Total Discrepancies</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{report.missing ?? 0}</div>
              <div className="text-xs text-red-500">Missing (→ LOST on close)</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{report.damaged ?? 0}</div>
              <div className="text-xs text-amber-500">Damaged</div>
            </div>
          </div>

          {/* Items Table — BUG 4 fix: was report.discrepancies (undefined) */}
          {discrepancyItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="mx-auto mb-3 text-green-400" size={48} />
              <p className="font-medium">No discrepancies found</p>
              <p className="text-sm mt-1">All items were verified successfully.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/30">
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Asset</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Location</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Condition</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Result</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Flagged By</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {discrepancyItems.map(item => (
                    <tr key={item.assetId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.assetTag}</div>
                        <div className="text-xs text-gray-500">{item.assetName}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.category || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.location || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.assetCondition || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          item.result === 'MISSING' ? 'bg-red-100 text-red-800' :
                          item.result === 'DAMAGED' ? 'bg-amber-100 text-amber-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          <StatusIcon result={item.result} />
                          {item.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.flaggedBy}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscrepancyReportModal;