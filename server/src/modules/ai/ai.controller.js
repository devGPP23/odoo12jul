const aiService = require('../../services/ai.service');
const asyncHandler = require('../../utils/asyncHandler');

class AiController {
  /**
   * 5A.2: POST /api/ai/search — NL asset search
   */
  nlSearch = asyncHandler(async (req, res) => {
    const { query, q } = req.body;
    const searchQuery = query || q;

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A search query is required.'
      });
    }

    const result = await aiService.nlAssetSearch(searchQuery);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * 5A.3: GET /api/ai/maintenance-risk/:assetId
   */
  maintenanceRisk = asyncHandler(async (req, res) => {
    const { assetId } = req.params;

    const result = await aiService.maintenanceRiskScore(assetId);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * 5A.4: GET /api/ai/audit-insights/:cycleId
   */
  auditInsights = asyncHandler(async (req, res) => {
    const { cycleId } = req.params;

    const result = await aiService.auditInsights(cycleId);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * 5A.5: GET /api/ai/report-summary?type=utilization
   */
  reportSummary = asyncHandler(async (req, res) => {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "type" is required (utilization, maintenance, or audit).'
      });
    }

    const result = await aiService.reportSummary(type);

    res.status(200).json({
      success: true,
      data: result
    });
  });
}

module.exports = new AiController();
