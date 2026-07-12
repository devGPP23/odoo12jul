/**
 * Audits Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const auditService = require('./service');

const createCycle = asyncHandler(async (req, res) => {
  const cycle = await auditService.createAuditCycle(req.body);
  res.locals.createdEntityId = cycle.id;
  res.status(201).json({ success: true, data: cycle });
});

const assignAuditors = asyncHandler(async (req, res) => {
  const assignments = await auditService.assignAuditors(req.params.id, req.body.auditorIds);
  res.json({ success: true, data: assignments });
});

const getAssets = asyncHandler(async (req, res) => {
  const assets = await auditService.getAuditAssets(req.params.id);
  res.json({ success: true, data: assets });
});

const createItems = asyncHandler(async (req, res) => {
  const items = await auditService.createAuditItems(
    req.params.id,
    req.body.auditorId || req.user.id,
    req.body.assetIds
  );
  res.status(201).json({ success: true, data: items });
});

const markItem = asyncHandler(async (req, res) => {
  const item = await auditService.markAuditItem(req.params.id, req.body);
  res.json({ success: true, data: item });
});

const closeCycle = asyncHandler(async (req, res) => {
  const report = await auditService.closeAuditCycle(req.params.id);
  res.json({ success: true, data: report });
});

const getCycles = asyncHandler(async (req, res) => {
  const result = await auditService.getAuditCycles(req.query);
  res.json({ success: true, data: result });
});

module.exports = { createCycle, assignAuditors, getAssets, createItems, markItem, closeCycle, getCycles };
