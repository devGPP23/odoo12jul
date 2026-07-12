-- AssetFlow: Hand-edited migration for booking exclusion constraint.
-- This must be applied AFTER the initial Prisma migration that creates the bookings table.
--
-- What this does:
-- The EXCLUDE USING gist constraint tells Postgres to physically refuse an INSERT
-- if any existing row for the same asset_id has an overlapping time slot,
-- as long as the booking is still upcoming or ongoing.
--
-- This means the INSERT itself IS the overlap check — no app-level pre-check SELECT needed.
-- If two booking requests arrive simultaneously, exactly one wins. The other gets error 23P01.

-- Required extension for GiST index on non-geometric types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add the exclusion constraint
-- Uses tstzrange(start_time, end_time) to create a range from the two timestamp columns
-- The constraint rejects any INSERT/UPDATE where:
--   1. asset_id matches an existing row (WITH =)
--   2. The time range overlaps an existing row (WITH &&)
--   3. Both the new and existing rows have status 'UPCOMING' or 'ONGOING'
ALTER TABLE bookings
ADD CONSTRAINT booking_no_overlap
EXCLUDE USING gist (
  asset_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status IN ('UPCOMING', 'ONGOING'));

-- Also add a CHECK constraint for the polymorphic holder on allocations:
-- Exactly one of employee_holder_id / department_holder_id must be non-null
ALTER TABLE allocations
ADD CONSTRAINT allocation_holder_check
CHECK (
  num_nonnulls(employee_holder_id, department_holder_id) = 1
);

-- Add a partial unique index to prevent double-allocation:
-- Only one ACTIVE allocation per asset at any time
CREATE UNIQUE INDEX allocation_active_unique
ON allocations (asset_id)
WHERE (status = 'ACTIVE');
