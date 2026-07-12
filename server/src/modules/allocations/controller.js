/**
 * Allocations Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const allocationService = require('./service');

const allocate = asyncHandler(async (req, res) => {
  const allocation = await allocationService.allocateAsset({
    ...req.body,
    allocatedBy: req.user.id,
  });
  res.locals.createdEntityId = allocation.id;
  res.status(201).json({ success: true, data: allocation });
});

const returnAsset = asyncHandler(async (req, res) => {
  const allocation = await allocationService.returnAsset(req.params.id, req.body);
  res.json({ success: true, data: allocation });
});

const createTransfer = asyncHandler(async (req, res) => {
  const transfer = await allocationService.createTransferRequest({
    ...req.body,
    requestedById: req.user.id,
  });
  res.locals.createdEntityId = transfer.id;
  res.status(201).json({ success: true, data: transfer });
});

const approveTransfer = asyncHandler(async (req, res) => {
  const transfer = await allocationService.approveTransfer(req.params.id, req.user.id);
  res.json({ success: true, data: transfer });
});

const rejectTransfer = asyncHandler(async (req, res) => {
  const transfer = await allocationService.rejectTransfer(req.params.id, req.user.id);
  res.json({ success: true, data: transfer });
});

const getAllocations = asyncHandler(async (req, res) => {
  const result = await allocationService.getAllocations(req.query);
  res.json({ success: true, data: result });
});

const getTransfers = asyncHandler(async (req, res) => {
  const result = await allocationService.getTransfers(req.query);
  res.json({ success: true, data: result });
});

module.exports = {
  allocate,
  returnAsset,
  createTransfer,
  approveTransfer,
  rejectTransfer,
  getAllocations,
  getTransfers,
};
