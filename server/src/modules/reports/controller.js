/**
 * Reports Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const reportService = require('./service');

const getUtilization = asyncHandler(async (req, res) => {
  const data = await reportService.getUtilization();
  res.json({ success: true, data });
});

const getMaintenanceFrequency = asyncHandler(async (req, res) => {
  const data = await reportService.getMaintenanceFrequency();
  res.json({ success: true, data });
});

const getDepartmentSummary = asyncHandler(async (req, res) => {
  const data = await reportService.getDepartmentAllocationSummary();
  res.json({ success: true, data });
});

const getBookingHeatmap = asyncHandler(async (req, res) => {
  const data = await reportService.getBookingHeatmap();
  res.json({ success: true, data });
});

module.exports = { getUtilization, getMaintenanceFrequency, getDepartmentSummary, getBookingHeatmap };
