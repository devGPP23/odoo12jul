/**
 * Maintenance Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const maintenanceService = require('./service');

const raise = asyncHandler(async (req, res) => {
  const request = await maintenanceService.raiseRequest({
    ...req.body,
    raisedById: req.user.id,
  });
  res.locals.createdEntityId = request.id;
  res.status(201).json({ success: true, data: request });
});

const approve = asyncHandler(async (req, res) => {
  const request = await maintenanceService.approveRequest(req.params.id, req.user.id);
  res.json({ success: true, data: request });
});

const reject = asyncHandler(async (req, res) => {
  const request = await maintenanceService.rejectRequest(req.params.id, req.user.id);
  res.json({ success: true, data: request });
});

const assignTechnician = asyncHandler(async (req, res) => {
  const request = await maintenanceService.assignTechnician(req.params.id, req.body.technicianId);
  res.json({ success: true, data: request });
});

const startProgress = asyncHandler(async (req, res) => {
  const request = await maintenanceService.startProgress(req.params.id);
  res.json({ success: true, data: request });
});

const resolve = asyncHandler(async (req, res) => {
  const request = await maintenanceService.resolveRequest(req.params.id);
  res.json({ success: true, data: request });
});

const getAll = asyncHandler(async (req, res) => {
  const result = await maintenanceService.getRequests(req.query);
  res.json({ success: true, data: result });
});

module.exports = { raise, approve, reject, assignTechnician, startProgress, resolve, getAll };
