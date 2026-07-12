const auditsService = require('./audits.service');
const asyncHandler = require('../../utils/asyncHandler');

class AuditsController {
  /**
   * 4A.1: POST /api/audit-cycles — create cycle
   */
  createCycle = asyncHandler(async (req, res) => {
    const {
      scopeType, scope_type,
      scopeValue, scope_value,
      dateStart, date_start,
      dateEnd, date_end
    } = req.body;

    const cycle = await auditsService.createCycle({
      scopeType: scopeType || scope_type,
      scopeValue: scopeValue || scope_value,
      dateStart: dateStart || date_start,
      dateEnd: dateEnd || date_end
    });

    res.status(201).json({
      success: true,
      message: 'Audit cycle created successfully',
      data: cycle
    });
  });

  /**
   * 4A.2: POST /api/audit-cycles/:id/assign-auditors
   */
  assignAuditors = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { auditorIds, auditor_ids } = req.body;

    const targetIds = auditorIds || auditor_ids;

    const result = await auditsService.assignAuditors(id, targetIds);

    res.status(200).json({
      success: true,
      message: 'Auditors assigned successfully',
      data: result
    });
  });

  /**
   * 4A.3: POST /api/audit-cycles/:id/populate — auto-populate items
   */
  populateItems = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await auditsService.populateItems(id);

    res.status(200).json({
      success: true,
      message: 'Audit items populated successfully',
      data: result
    });
  });

  /**
   * 4A.4: GET /api/audit-cycles/:id/items — paginated with progress
   */
  getCycleItems = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await auditsService.getCycleItems(id, { page, limit });

    res.status(200).json({
      success: true,
      ...result
    });
  });

  /**
   * GET /api/audit-cycles — list all cycles
   */
  getAllCycles = asyncHandler(async (req, res) => {
    const { status, scopeType, page = 1, limit = 20 } = req.query;

    const result = await auditsService.getAllCycles({ status, scopeType, page, limit });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });
}

module.exports = new AuditsController();
