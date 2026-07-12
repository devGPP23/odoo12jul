/**
 * Allocations Controller — Phase 2A
 *
 * Thin controller layer: extracts HTTP params, delegates to service,
 * formats the response. All business logic lives in allocations.service.js.
 */

const allocationsService = require('./allocations.service');
const asyncHandler = require('../../utils/asyncHandler');

class AllocationsController {
  /**
   * POST /api/allocations
   * Allocate an asset to an employee or department.
   */
  allocate = asyncHandler(async (req, res) => {
    const result = await allocationsService.allocate(req.body, req.user);

    if (result.alreadyExisted) {
      return res.status(200).json({
        success: true,
        message: 'Asset was already allocated to this holder (idempotent response).',
        data: result.allocation,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Asset allocated successfully.',
      data: result.allocation,
    });
  });

  /**
   * POST /api/allocations/:id/return
   * Return an asset from an active or overdue allocation.
   */
  returnAllocation = asyncHandler(async (req, res) => {
    const result = await allocationsService.returnAllocation(
      req.params.id,
      req.body,
      req.user
    );

    const message = result.suggestMaintenance
      ? 'Asset returned. Asset condition is damaged — consider raising a maintenance request.'
      : 'Asset returned successfully.';

    return res.status(200).json({
      success: true,
      message,
      data: result,
    });
  });

  /**
   * GET /api/allocations/:id
   * Fetch full allocation details.
   */
  getById = asyncHandler(async (req, res) => {
    const result = await allocationsService.getById(req.params.id);
    return res.status(200).json({ success: true, data: result });
  });

  /**
   * GET /api/allocations
   * List allocations with filters and pagination.
   * DEPT_HEADs are automatically scoped to their own department (AL6).
   */
  list = asyncHandler(async (req, res) => {
    const filters = {
      assetId:      req.query.assetId,
      employeeId:   req.query.employeeId,
      departmentId: req.query.departmentId,
      status:       req.query.status,
    };
    const pagination = {
      page:  parseInt(req.query.page,  10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    };

    const result = await allocationsService.list(filters, pagination, req.user);

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });
}

module.exports = new AllocationsController();