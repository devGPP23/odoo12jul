const transfersService = require('./transfers.service');
const asyncHandler = require('../../utils/asyncHandler');

class TransfersController {
  createTransferRequest = asyncHandler(async (req, res) => {
    const result = await transfersService.createTransferRequest(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Transfer request created successfully',
      data: result,
    });
  });

  approveTransfer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await transfersService.approveTransfer(id, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Transfer approved successfully',
      data: result,
    });
  });

  rejectTransfer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const result = await transfersService.rejectTransfer(id, rejectionReason, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Transfer rejected',
      data: result,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await transfersService.getById(id);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  list = asyncHandler(async (req, res) => {
    const filters = {
      assetId: req.query.assetId,
      status: req.query.status,
      requesterId: req.query.requesterId,
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await transfersService.list(filters, pagination);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });
}

module.exports = new TransfersController();