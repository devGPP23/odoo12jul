const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');

// 3B.6 - GET /api/dashboard/kpis (Redis Cache wala)
router.get('/kpis', dashboardController.kpisDataLao);

// 3B.7 - GET /api/dashboard/overdue (Real-time)
router.get('/overdue', dashboardController.overdueLao);

// Gamification - GET /api/dashboard/trust-score
router.get('/trust-score', dashboardController.trustScoreLao);

module.exports = router;
