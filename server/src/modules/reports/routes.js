/**
 * Reports Module — Routes.
 */

const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

router.use(authenticate, requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']));

router.get('/utilization', controller.getUtilization);
router.get('/maintenance-frequency', controller.getMaintenanceFrequency);
router.get('/department-allocation-summary', controller.getDepartmentSummary);
router.get('/booking-heatmap', controller.getBookingHeatmap);

module.exports = router;
