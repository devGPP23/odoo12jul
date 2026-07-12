/**
 * Asset Lifecycle State Machine.
 *
 * The ONE place in the entire codebase that writes Asset.status.
 * Every workflow (allocation, booking, maintenance, audit) calls
 * transitionAssetStatus() — no scattered `asset.status = 'x'` writes.
 *
 * Enforces legal transitions based on the state table from the architecture doc.
 */

const { prisma } = require('../config/postgres');
const AppError = require('../utils/AppError');

/**
 * Legal state transitions.
 * Key = current status, Value = array of allowed target statuses.
 */
const TRANSITIONS = {
  AVAILABLE: ['ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED'],
  ALLOCATED: ['AVAILABLE', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED'],
  RESERVED: ['AVAILABLE'],
  UNDER_MAINTENANCE: ['AVAILABLE', 'LOST'],
  LOST: [], // Terminal for practical purposes (admin can override via RETIRED/DISPOSED)
  RETIRED: ['DISPOSED'],
  DISPOSED: [], // Terminal
};

/**
 * Transition an asset's status with validation.
 *
 * @param {string} assetId - The asset to transition
 * @param {string} newStatus - Target AssetStatus enum value
 * @param {string} reason - Why this transition is happening (for audit trail)
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx] - Optional Prisma transaction client
 * @returns {Promise<import('@prisma/client').Asset>} Updated asset
 * @throws {AppError} If transition is illegal
 */
async function transitionAssetStatus(assetId, newStatus, reason, tx = null) {
  const db = tx || prisma;

  // Fetch current status
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { id: true, status: true, assetTag: true },
  });

  if (!asset) {
    throw new AppError(`Asset ${assetId} not found.`, 404);
  }

  const currentStatus = asset.status;

  // Check if transition is legal
  const allowedTargets = TRANSITIONS[currentStatus];
  if (!allowedTargets) {
    throw new AppError(
      `Asset ${asset.assetTag} is in terminal state '${currentStatus}' and cannot be transitioned.`,
      400
    );
  }

  if (!allowedTargets.includes(newStatus)) {
    throw new AppError(
      `Illegal transition: ${currentStatus} → ${newStatus} for asset ${asset.assetTag}. ` +
        `Allowed transitions from ${currentStatus}: ${allowedTargets.join(', ') || 'none'}.`,
      400
    );
  }

  // Perform the transition
  const updated = await db.asset.update({
    where: { id: assetId },
    data: { status: newStatus },
  });

  console.log(
    `📦 Asset ${asset.assetTag}: ${currentStatus} → ${newStatus} (${reason})`
  );

  return updated;
}

/**
 * Get allowed transitions for a given status.
 */
function getAllowedTransitions(currentStatus) {
  return TRANSITIONS[currentStatus] || [];
}

module.exports = { transitionAssetStatus, getAllowedTransitions, TRANSITIONS };
