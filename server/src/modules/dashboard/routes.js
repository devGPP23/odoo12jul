/**
 * Dashboard Module — Routes.
 */

const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

router.get('/kpis', controller.getKPIs);
router.get('/overdue', controller.getOverdue);

module.exports = router;
