/**
 * Assets Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const assetService = require('./service');

const register = asyncHandler(async (req, res) => {
  const asset = await assetService.registerAsset(req.body);
  res.locals.createdEntityId = asset.id;
  res.status(201).json({ success: true, data: asset });
});

const getAll = asyncHandler(async (req, res) => {
  const result = await assetService.getAssets(req.query);
  res.json({ success: true, data: result });
});

const getById = asyncHandler(async (req, res) => {
  const asset = await assetService.getAssetById(req.params.id);
  res.json({ success: true, data: asset });
});

const getHistory = asyncHandler(async (req, res) => {
  const history = await assetService.getAssetHistory(req.params.id);
  res.json({ success: true, data: history });
});

const update = asyncHandler(async (req, res) => {
  const asset = await assetService.updateAsset(req.params.id, req.body);
  res.json({ success: true, data: asset });
});

module.exports = { register, getAll, getById, getHistory, update };
