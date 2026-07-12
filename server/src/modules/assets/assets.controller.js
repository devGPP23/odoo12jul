const assetsService = require('./assets.service');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');

// VAHI H ASSET PE CRUD OPERATION LAGANA 
// - Register Asset
exports.registerAsset = asyncHandler(async (req, res) => {
  const asset = await assetsService.registerAsset(req.body);
  res.status(201).json({
    success: true,
    data: asset,
    message: 'Asset registered successfully'
  });
});

// Get all assets with filters
exports.getAssets = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  
  const result = await assetsService.getAssets(req.query, page, limit);
  
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
});

exports.getAssetById = asyncHandler(async (req, res) => {
  const asset = await assetsService.getAssetById(req.params.id);
  res.status(200).json({
    success: true,
    data: asset
  });
});
 // KISKO KITNA ALLOCATE HUA YE DEKH LO 
// Asset History Endpoint
exports.getAssetHistory = asyncHandler(async (req, res) => {
  const history = await assetsService.getAssetHistory(req.params.id);
  res.status(200).json({
    success: true,
    data: history
  });
});

exports.updateAsset = asyncHandler(async (req, res) => {
  const asset = await assetsService.updateAsset(req.params.id, req.body);
  res.status(200).json({
    success: true,
    data: asset,
    message: 'Asset updated successfully'
  });
});

exports.deleteAsset = asyncHandler(async (req, res) => {
  const result = await assetsService.deleteAsset(req.params.id);
  res.status(200).json({
    success: true,
    message: result.message
  });
});
