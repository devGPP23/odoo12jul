const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');

// 4B.1 - GET /api/reports/utilization
router.get('/utilization', reportsController.utilizationLao);

// 4B.2 - GET /api/reports/maintenance-frequency
router.get('/maintenance-frequency', reportsController.maintenanceFrequencyLao);

// 4B.3 - GET /api/reports/department-allocation
router.get('/department-allocation', reportsController.departmentAllocationLao);

// 4B.4 - GET /api/reports/booking-heatmap
router.get('/booking-heatmap', reportsController.bookingHeatmapLao);

// 4B.5 - GET /api/reports/export?type=utilization&format=csv
router.get('/export', reportsController.exportCsvLao);

module.exports = router;
