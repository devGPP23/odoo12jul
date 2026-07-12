/**
 * Activity logger middleware.
 * Intercepts state-changing requests (POST/PUT/PATCH/DELETE) and writes
 * to MongoDB ActivityLog as a fire-and-forget operation.
 *
 * Does NOT block the response — if Mongo hiccups, the primary operation
 * still succeeds. This is by design (Postgres commit should never fail
 * because of a Mongo issue).
 */

const ActivityLog = require('../models/mongo/ActivityLog');

/**
 * Extracts entity type and id from the request path.
 * e.g. /api/assets/abc-123 → { entityType: 'asset', entityId: 'abc-123' }
 */
function extractEntityInfo(path) {
  const segments = path.replace('/api/', '').split('/');

  // Map route segments to entity types
  const routeToEntity = {
    assets: 'asset',
    allocations: 'allocation',
    bookings: 'booking',
    'maintenance-requests': 'maintenance',
    transfers: 'transfer',
    'audit-cycles': 'audit',
    departments: 'department',
    employees: 'employee',
    'asset-categories': 'asset_category',
  };

  const entityType = routeToEntity[segments[0]] || segments[0];
  const entityId = segments[1] || null;

  return { entityType, entityId };
}

/**
 * Derives a human-readable action from method + path.
 */
function deriveAction(method, path) {
  const segments = path.replace('/api/', '').split('/');
  const resource = segments[0]?.toUpperCase().replace(/-/g, '_') || 'UNKNOWN';
  const subAction = segments[2]?.toUpperCase().replace(/-/g, '_') || '';

  const methodMap = {
    POST: 'CREATED',
    PUT: 'UPDATED',
    PATCH: 'UPDATED',
    DELETE: 'DELETED',
  };

  if (subAction) {
    return `${resource}_${subAction}`;
  }

  return `${resource}_${methodMap[method] || 'ACCESSED'}`;
}

function activityLogger(req, res, next) {
  // Only log state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip auth routes (login/signup shouldn't be logged as activity)
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Hook into response finish to log after the response is sent
  const originalEnd = res.end;
  res.end = function (...args) {
    // Only log successful operations (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const { entityType, entityId } = extractEntityInfo(req.path);

      // Fire-and-forget — no await, no error propagation
      ActivityLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: deriveAction(req.method, req.path),
        entityType,
        entityId: entityId || res.locals.createdEntityId || 'unknown',
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          // Don't log full body (security), but log key identifiers
          ...(req.body?.assetId && { assetId: req.body.assetId }),
          ...(req.body?.name && { name: req.body.name }),
        },
        ipAddress: req.ip,
      }).catch((err) => {
        console.error('⚠️  Activity log write failed (non-blocking):', err.message);
      });
    }

    originalEnd.apply(res, args);
  };

  next();
}

module.exports = activityLogger;
