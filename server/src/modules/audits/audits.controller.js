/**
 * Audits Controller — Phase 4
 *
 * Thin controller layer delegating to AuditsService.
 */

const auditsService = require('./audits.service');
const asyncHandler = require('../../utils/asyncHandler');

class AuditsController {
  /**
   * POST /api/audit-cycles
   * Create a new audit cycle.
   */
  createCycle = asyncHandler(async (req, res) => {
    const result = await auditsService.createAuditCycle(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Audit cycle created successfully',
      data: result,
    });
  });

  /**
   * POST /api/audit-cycles/:id/assign-auditors
   * Assign auditors to an audit cycle.
   */
  assignAuditors = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { auditorIds } = req.body;

    if (!Array.isArray(auditorIds) || auditorIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'auditorIds must be a non-empty array',
      });
    }

    const result = await auditsService.assignAuditors(id, auditorIds, req.user);
    res.status(200).json({
      success: true,
      message: 'Auditors assigned successfully',
      data: result,
    });
  });

  /**
   * GET /api/audit-cycles/:id/items
   * Get audit items with pagination and progress summary.
   */
  getCycleItems = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const result = await auditsService.getCycleWithItems(id, { page, limit });
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      progress: result.progress,
    });
  });

  /**
   * PUT /api/audit-items/:id
   * Mark an audit item result (VERIFIED/MISSING/DAMAGED).
   * Only the assigned auditor can mark.
   */
  markItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { result, notes } = req.body;

    const updated = await auditsService.markItem(id, req.user, { result, notes });
    res.status(200).json({
      success: true,
      message: 'Audit item updated',
      data: updated,
    });
  });

  /**
   * POST /api/audit-cycles/:id/close
   * Atomically close an audit cycle:
   * - Lock cycle
   * - Check pending items (offer force-close)
   * - For each MISSING item → transitionAssetStatus → 'lost'
   * - Generate discrepancy report
   * - Set status = 'closed'
   * - Emit audit.closed event
   */
  closeCycle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { forceClose } = req.body;

    const result = await auditsService.closeAuditCycle(id, forceClose, req.user);
    res.status(200).json({
      success: true,
      message: forceClose ? 'Audit cycle force-closed' : 'Audit cycle closed successfully',
      data: result,
    });
  });

  /**
   * GET /api/audit-cycles/:id/report
   * Get discrepancy report: all items with result = 'MISSING' or 'DAMAGED'.
   */
  getReport = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const report = await auditsService.getDiscrepancyReport(id);
    res.status(200).json({
      success: true,
      data: report,
    });
  });

  /**
   * GET /api/audit-cycles
   * List audit cycles with pagination.
   */
  listCycles = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const status = req.query.status;

    const result = await auditsService.listCycles({ page, limit, status });
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });

  /**
   * GET /api/audit-cycles/:id
   * Get audit cycle details.
   */
  getCycle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const cycle = await auditsService.getCycleById(id);
    res.status(200).json({ success: true, data: cycle });
  });
}

module.exports = new AuditsController();