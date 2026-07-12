const allocationsService = require('./allocations.service');
const asyncHandler = require('../../utils/asyncHandler');

class AllocationsController {
  // Allocate asset
  allocate = asyncHandler(async (req, res) => {
    const { assetId, employeeHolderId, departmentHolderId, expectedReturnDate } = req.body;

    const allocation = await allocationsService.allocate({
      assetId,
      employeeHolderId,
      departmentHolderId,
      expectedReturnDate
    });

    res.status(201).json({
      success: true,
      message: 'Asset allocated successfully',
      data: allocation
    });
  });

  // Return asset
  returnAllocation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { condition, notes } = req.body;

    const result = await allocationsService.returnAllocation(id, { condition, notes });

    res.status(200).json({
      success: true,
      message: 'Asset returned successfully',
      data: result.allocation,
      suggestMaintenance: result.suggestMaintenance
    });
  });

  // Create transfer request
  createTransferRequest = asyncHandler(async (req, res) => {
    const { assetId, fromHolderId, toHolderId } = req.body;
    const requestedById = req.user.id; // From JWT

    const transferRequest = await allocationsService.createTransferRequest({
      assetId,
      fromHolderId,
      toHolderId,
      requestedById
    });

    res.status(201).json({
      success: true,
      message: 'Transfer request created successfully',
      data: transferRequest
    });
  });

  // Approve transfer request
  approveTransfer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const approvedById = req.user.id; // From JWT

    const transferRequest = await allocationsService.approveTransferRequest(id, approvedById);

    res.status(200).json({
      success: true,
      message: 'Transfer request approved successfully',
      data: transferRequest
    });
  });

  // Reject transfer request
  rejectTransfer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rejectedById = req.user.id; // From JWT

    const transferRequest = await allocationsService.rejectTransferRequest(id, rejectedById);

    res.status(200).json({
      success: true,
      message: 'Transfer request rejected successfully',
      data: transferRequest
    });
  });
}

module.exports = new AllocationsController();
