/**
 * 5A.1: AI Service — Gemini API wrapper.
 * Single module; all AI features route through here.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { prisma } = require('../config/postgres');
const { getRedisClient } = require('../config/redis');
const AppError = require('../utils/AppError');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    if (!GEMINI_API_KEY) {
      throw new AppError('GEMINI_API_KEY is not configured. Set it in your .env file.', 503);
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

/**
 * Helper: call Gemini and get text response.
 */
async function askGemini(prompt) {
  try {
    const m = getModel();
    const result = await m.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('Gemini API error:', err.message);
    throw new AppError('AI service temporarily unavailable.', 503);
  }
}

/**
 * Helper: try to parse JSON from Gemini response (strips markdown fences).
 */
function parseJsonResponse(text) {
  let cleaned = text.trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }
  return JSON.parse(cleaned);
}

// ────────────────────────────────────────────────────────────
// 5A.2: Natural Language Asset Search
// ────────────────────────────────────────────────────────────
async function nlAssetSearch(query) {
  const prompt = `You are a database query assistant for an asset management system.
The user wants to search assets. Convert their natural language query into a structured JSON filter object.

Available filter fields:
- name (string, partial match)
- assetTag (string, exact match)
- status (enum: AVAILABLE, ALLOCATED, UNDER_MAINTENANCE, DISPOSED, RETIRED, LOST)
- condition (enum: NEW, GOOD, FAIR, POOR, DAMAGED)
- location (string, partial match)
- categoryName (string, partial match)
- isBookable (boolean)

User query: "${query}"

Respond ONLY with a valid JSON object containing the applicable filters. Example:
{"name": "laptop", "status": "AVAILABLE", "location": "Building A"}

If the query is unclear, return {} (empty object). Do NOT include explanation text.`;

  const responseText = await askGemini(prompt);
  let filters;
  try {
    filters = parseJsonResponse(responseText);
  } catch {
    filters = {};
  }

  // Build Prisma where clause from AI-parsed filters
  const where = {};
  if (filters.name) where.name = { contains: filters.name, mode: 'insensitive' };
  if (filters.assetTag) where.assetTag = filters.assetTag;
  if (filters.status) where.status = filters.status;
  if (filters.condition) where.condition = filters.condition;
  if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };
  if (filters.isBookable !== undefined) where.isBookable = filters.isBookable;
  if (filters.categoryName) {
    where.category = { name: { contains: filters.categoryName, mode: 'insensitive' } };
  }

  const assets = await prisma.asset.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } }
    },
    take: 50,
    orderBy: { createdAt: 'desc' }
  });

  return {
    query,
    parsedFilters: filters,
    resultCount: assets.length,
    assets
  };
}

// ────────────────────────────────────────────────────────────
// 5A.3: Predictive Maintenance Scoring
// ────────────────────────────────────────────────────────────
async function maintenanceRiskScore(assetId) {
  // Try Redis cache first (TTL 24h)
  const cacheKey = `ai:maintenance-risk:${assetId}`;
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      const cached = await redis.get(cacheKey);
      if (cached) return { ...JSON.parse(cached), cached: true };
    }
  } catch { /* Redis not available, continue without cache */ }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      category: { select: { name: true } },
      maintenanceRequests: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, status: true, priority: true,
          issueDescription: true, createdAt: true, resolvedAt: true
        }
      }
    }
  });

  if (!asset) {
    throw new AppError('Asset not found.', 404);
  }

  // Calculate asset age in months
  const ageMonths = asset.acquisitionDate
    ? Math.floor((Date.now() - new Date(asset.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  // Count category-wide maintenance average
  const categoryAssets = await prisma.asset.findMany({
    where: { categoryId: asset.categoryId },
    select: { id: true }
  });
  const categoryAssetIds = categoryAssets.map(a => a.id);
  const categoryMaintenanceCount = await prisma.maintenanceRequest.count({
    where: { assetId: { in: categoryAssetIds } }
  });
  const categoryAvg = categoryAssetIds.length > 0
    ? (categoryMaintenanceCount / categoryAssetIds.length).toFixed(2)
    : 0;

  const prompt = `You are a predictive maintenance AI analyst for an enterprise asset management system.

Analyze this asset and provide a maintenance risk score (0-100) with reasoning.

Asset Details:
- Name: ${asset.name}
- Tag: ${asset.assetTag}
- Category: ${asset.category?.name || 'Unknown'}
- Condition: ${asset.condition}
- Status: ${asset.status}
- Age: ${ageMonths !== null ? ageMonths + ' months' : 'Unknown'}
- Acquisition Cost: ${asset.acquisitionCost || 'Unknown'}

Maintenance History (last 10):
${asset.maintenanceRequests.length > 0
  ? asset.maintenanceRequests.map(r =>
    `  - [${r.priority}] ${r.issueDescription} (${r.status}, created: ${r.createdAt.toISOString().split('T')[0]})`
  ).join('\n')
  : '  No maintenance history.'}

Category Average: ${categoryAvg} maintenance requests per asset in this category.

Respond ONLY with valid JSON:
{
  "riskScore": <number 0-100>,
  "riskLevel": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "reasoning": "<2-3 sentence explanation>",
  "recommendations": ["<action 1>", "<action 2>"],
  "estimatedNextMaintenance": "<timeframe like 'within 3 months' or 'not needed soon'>"
}`;

  const responseText = await askGemini(prompt);
  let analysis;
  try {
    analysis = parseJsonResponse(responseText);
  } catch {
    analysis = {
      riskScore: 50,
      riskLevel: 'MEDIUM',
      reasoning: 'AI analysis could not be parsed. Default medium risk assigned.',
      recommendations: ['Schedule a manual inspection'],
      estimatedNextMaintenance: 'Unknown'
    };
  }

  const result = {
    assetId,
    assetTag: asset.assetTag,
    assetName: asset.name,
    condition: asset.condition,
    ageMonths,
    maintenanceCount: asset.maintenanceRequests.length,
    categoryAvgMaintenance: parseFloat(categoryAvg),
    analysis,
    generatedAt: new Date().toISOString()
  };

  // Cache in Redis for 24 hours
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.setex(cacheKey, 86400, JSON.stringify(result));
    }
  } catch { /* Redis unavailable, skip caching */ }

  return result;
}

// ────────────────────────────────────────────────────────────
// 5A.4: Audit Anomaly Detection
// ────────────────────────────────────────────────────────────
async function auditInsights(cycleId) {
  const cycle = await prisma.auditCycle.findUnique({
    where: { id: cycleId },
    include: {
      items: {
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true, condition: true, location: true } },
          auditor: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!cycle) {
    throw new AppError('Audit cycle not found.', 404);
  }

  // Gather progress
  const total = cycle.items.length;
  const verified = cycle.items.filter(i => i.result === 'VERIFIED').length;
  const missing = cycle.items.filter(i => i.result === 'MISSING').length;
  const damaged = cycle.items.filter(i => i.result === 'DAMAGED').length;
  const pending = cycle.items.filter(i => !i.result).length;

  // Gather historical data for comparison
  const previousCycles = await prisma.auditCycle.findMany({
    where: {
      scopeType: cycle.scopeType,
      scopeValue: cycle.scopeValue,
      status: 'CLOSED',
      id: { not: cycleId }
    },
    include: {
      items: { select: { result: true } }
    },
    orderBy: { dateEnd: 'desc' },
    take: 3
  });

  const historicalSummary = previousCycles.map(pc => ({
    dateRange: `${pc.dateStart.toISOString().split('T')[0]} to ${pc.dateEnd.toISOString().split('T')[0]}`,
    total: pc.items.length,
    missing: pc.items.filter(i => i.result === 'MISSING').length,
    damaged: pc.items.filter(i => i.result === 'DAMAGED').length
  }));

  const prompt = `You are an audit anomaly detection AI for an enterprise asset management system.

Analyze this audit cycle and flag any anomalies.

Current Audit Cycle:
- Scope: ${cycle.scopeType} = "${cycle.scopeValue}"
- Date Range: ${cycle.dateStart.toISOString().split('T')[0]} to ${cycle.dateEnd.toISOString().split('T')[0]}
- Status: ${cycle.status}
- Results: Total=${total}, Verified=${verified}, Missing=${missing}, Damaged=${damaged}, Pending=${pending}

Missing Assets:
${cycle.items.filter(i => i.result === 'MISSING').map(i =>
  `  - ${i.asset.assetTag}: ${i.asset.name} (location: ${i.asset.location || 'unknown'})`
).join('\n') || '  None'}

Damaged Assets:
${cycle.items.filter(i => i.result === 'DAMAGED').map(i =>
  `  - ${i.asset.assetTag}: ${i.asset.name} (condition: ${i.asset.condition})`
).join('\n') || '  None'}

Historical Comparison (last 3 cycles for same scope):
${historicalSummary.length > 0
  ? historicalSummary.map(h =>
    `  - ${h.dateRange}: Total=${h.total}, Missing=${h.missing}, Damaged=${h.damaged}`
  ).join('\n')
  : '  No historical data available.'}

Respond ONLY with valid JSON:
{
  "anomalies": [
    { "type": "<MISSING_SPIKE|DAMAGE_PATTERN|LOCATION_CLUSTER|OTHER>", "severity": "<LOW|MEDIUM|HIGH>", "description": "<explanation>" }
  ],
  "overallRiskLevel": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "summary": "<2-3 sentence executive summary>",
  "recommendations": ["<action 1>", "<action 2>"]
}`;

  const responseText = await askGemini(prompt);
  let insights;
  try {
    insights = parseJsonResponse(responseText);
  } catch {
    insights = {
      anomalies: [],
      overallRiskLevel: 'LOW',
      summary: 'AI analysis could not be parsed. Manual review recommended.',
      recommendations: ['Review audit results manually']
    };
  }

  return {
    cycleId,
    scope: { type: cycle.scopeType, value: cycle.scopeValue },
    progress: { total, verified, missing, damaged, pending },
    historicalComparison: historicalSummary,
    insights,
    generatedAt: new Date().toISOString()
  };
}

// ────────────────────────────────────────────────────────────
// 5A.5: Report Summarization
// ────────────────────────────────────────────────────────────
async function reportSummary(type) {
  let dataContext = '';

  if (type === 'utilization') {
    const [totalAssets, allocatedAssets, maintenanceAssets, availableAssets] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({ where: { status: 'ALLOCATED' } }),
      prisma.asset.count({ where: { status: 'UNDER_MAINTENANCE' } }),
      prisma.asset.count({ where: { status: 'AVAILABLE' } })
    ]);

    const recentAllocations = await prisma.allocation.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    });

    const recentReturns = await prisma.allocation.count({
      where: {
        status: 'RETURNED',
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    dataContext = `Asset Utilization Report Data:
- Total Assets: ${totalAssets}
- Currently Allocated: ${allocatedAssets} (${totalAssets > 0 ? ((allocatedAssets / totalAssets) * 100).toFixed(1) : 0}%)
- Under Maintenance: ${maintenanceAssets}
- Available: ${availableAssets}
- Allocations in Last 30 Days: ${recentAllocations}
- Returns in Last 30 Days: ${recentReturns}
- Utilization Rate: ${totalAssets > 0 ? ((allocatedAssets / totalAssets) * 100).toFixed(1) : 0}%`;
  } else if (type === 'maintenance') {
    const [totalRequests, pendingRequests, resolvedRequests, criticalRequests] = await Promise.all([
      prisma.maintenanceRequest.count(),
      prisma.maintenanceRequest.count({ where: { status: 'PENDING' } }),
      prisma.maintenanceRequest.count({ where: { status: 'RESOLVED' } }),
      prisma.maintenanceRequest.count({ where: { priority: 'CRITICAL' } })
    ]);

    const recentRequests = await prisma.maintenanceRequest.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    });

    dataContext = `Maintenance Report Data:
- Total Requests (all time): ${totalRequests}
- Currently Pending: ${pendingRequests}
- Resolved: ${resolvedRequests}
- Critical Priority: ${criticalRequests}
- New Requests in Last 30 Days: ${recentRequests}
- Resolution Rate: ${totalRequests > 0 ? ((resolvedRequests / totalRequests) * 100).toFixed(1) : 0}%`;
  } else if (type === 'audit') {
    const [totalCycles, openCycles, closedCycles] = await Promise.all([
      prisma.auditCycle.count(),
      prisma.auditCycle.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.auditCycle.count({ where: { status: 'CLOSED' } })
    ]);

    const totalItems = await prisma.auditItem.count();
    const missingItems = await prisma.auditItem.count({ where: { result: 'MISSING' } });
    const damagedItems = await prisma.auditItem.count({ where: { result: 'DAMAGED' } });

    dataContext = `Audit Report Data:
- Total Audit Cycles: ${totalCycles}
- Currently Open/In Progress: ${openCycles}
- Closed: ${closedCycles}
- Total Items Audited: ${totalItems}
- Items Marked Missing: ${missingItems}
- Items Marked Damaged: ${damagedItems}
- Issue Rate: ${totalItems > 0 ? (((missingItems + damagedItems) / totalItems) * 100).toFixed(1) : 0}%`;
  } else {
    throw new AppError('Invalid report type. Use: utilization, maintenance, or audit.', 400);
  }

  const prompt = `You are a C-level executive report writer for an enterprise asset management platform.

Generate a concise, professional executive summary based on this data.

${dataContext}

Respond ONLY with valid JSON:
{
  "title": "<Report Title>",
  "executiveSummary": "<3-5 sentence summary for leadership>",
  "keyMetrics": [
    { "label": "<metric name>", "value": "<metric value>", "trend": "<UP|DOWN|STABLE>" }
  ],
  "highlights": ["<positive highlight 1>", "<positive highlight 2>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "recommendations": ["<action 1>", "<action 2>"]
}`;

  const responseText = await askGemini(prompt);
  let summary;
  try {
    summary = parseJsonResponse(responseText);
  } catch {
    summary = {
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      executiveSummary: 'AI summary generation failed. Please review the raw data.',
      keyMetrics: [],
      highlights: [],
      concerns: [],
      recommendations: ['Review raw data manually']
    };
  }

  return {
    type,
    summary,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  askGemini,
  nlAssetSearch,
  maintenanceRiskScore,
  auditInsights,
  reportSummary
};
