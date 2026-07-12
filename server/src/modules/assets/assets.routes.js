const express = require('express');
const router = express.Router();
const assetsController = require('./assets.controller');
// const { protect, restrictTo } = require('../../middleware/auth');

// BASIC ROUTING KR DI HAI 
// Asset History (1B.2)
router.get('/:id/history', assetsController.getAssetHistory);

// CRUD routes (1B.1)
router.route('/')
  .post(assetsController.registerAsset)
  .get(assetsController.getAssets);

router.route('/:id')
  .get(assetsController.getAssetById)
  .put(assetsController.updateAsset)
  .delete(assetsController.deleteAsset);

module.exports = router;
