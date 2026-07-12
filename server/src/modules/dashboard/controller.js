/**
 * Dashboard Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const dashboardService = require('./service');

const getKPIs = asyncHandler(async (req, res) => {
  const kpis = await dashboardService.getKPIs();
  res.json({ success: true, data: kpis });
});

const getOverdue = asyncHandler(async (req, res) => {
  const overdue = await dashboardService.getOverdue();
  res.json({ success: true, data: overdue });
});

module.exports = { getKPIs, getOverdue };
