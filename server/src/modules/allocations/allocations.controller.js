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
    const { condition, return_condition, notes } = req.body;

    const targetCondition = return_condition || condition;

    const result = await allocationsService.returnAllocation(id, {
      condition: targetCondition ? targetCondition.toUpperCase() : undefined,
      notes
    });

    res.status(200).json({
      success: true,
      message: 'Asset returned successfully',
      data: result.allocation,
      suggestMaintenance: result.suggestMaintenance
    });
  });

  // Create transfer request
  createTransferRequest = asyncHandler(async (req, res) => {
    const { 
      assetId, asset_id, 
      fromHolderId, from_holder_id, from_user, fromUserId,
      toHolderId, to_holder_id, to_user, toUserId 
    } = req.body;
    const requestedById = req.user.id; // From JWT

    const targetAssetId = assetId || asset_id;
    const targetFromHolderId = fromHolderId || from_holder_id || from_user || fromUserId;
    const targetToHolderId = toHolderId || to_holder_id || to_user || toUserId;

    const transferRequest = await allocationsService.createTransferRequest({
      assetId: targetAssetId,
      fromHolderId: targetFromHolderId,
      toHolderId: targetToHolderId,
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
