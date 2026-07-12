/**
 * Prisma Seed Script.
 *
 * Seeds the initial Admin account and demo data for development.
 * Run via: npx prisma db seed (or node prisma/seed.js)
 *
 * The Admin is the ONLY way to bootstrap the system — all other
 * role assignments flow through the Admin's promote endpoint.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Create Admin ────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
  const admin = await prisma.employee.upsert({
    where: { email: 'admin@assetflow.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@assetflow.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Admin: ${admin.email} (password: admin123)`);

  // ── 2. Create Departments ──────────────────────────────────
  const departments = [
    { name: 'Engineering', status: 'ACTIVE' },
    { name: 'Human Resources', status: 'ACTIVE' },
    { name: 'Operations', status: 'ACTIVE' },
    { name: 'Marketing', status: 'ACTIVE' },
    { name: 'Finance', status: 'ACTIVE' },
  ];

  const createdDepts = [];
  for (const dept of departments) {
    const d = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    createdDepts.push(d);
    console.log(`  ✅ Department: ${d.name}`);
  }

  // ── 3. Create Asset Categories ─────────────────────────────
  const categories = [
    { name: 'Electronics', customFields: { warrantyPeriod: 'months', brand: 'text' } },
    { name: 'Furniture', customFields: { material: 'text', color: 'text' } },
    { name: 'Vehicles', customFields: { make: 'text', model: 'text', year: 'number', licensePlate: 'text' } },
    { name: 'Office Equipment', customFields: { manufacturer: 'text' } },
    { name: 'Conference Rooms', customFields: { capacity: 'number', floor: 'text' } },
    { name: 'Lab Equipment', customFields: { calibrationDate: 'date' } },
  ];

  const createdCategories = [];
  for (const cat of categories) {
    const c = await prisma.assetCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdCategories.push(c);
    console.log(`  ✅ Category: ${c.name}`);
  }

  // ── 4. Create Sample Employees ─────────────────────────────
  const employees = [
    { name: 'Priya Sharma', email: 'priya@assetflow.com', department: 'Engineering' },
    { name: 'Raj Patel', email: 'raj@assetflow.com', department: 'Engineering' },
    { name: 'Ananya Gupta', email: 'ananya@assetflow.com', department: 'Operations' },
    { name: 'Vikram Singh', email: 'vikram@assetflow.com', department: 'Marketing' },
    { name: 'Meera Joshi', email: 'meera@assetflow.com', department: 'Human Resources' },
  ];

  const empPassword = await bcrypt.hash('employee123', SALT_ROUNDS);
  for (const emp of employees) {
    const dept = createdDepts.find((d) => d.name === emp.department);
    const e = await prisma.employee.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        name: emp.name,
        email: emp.email,
        passwordHash: empPassword,
        departmentId: dept?.id || null,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });
    console.log(`  ✅ Employee: ${e.name} (${e.email}, password: employee123)`);
  }

  // ── 5. Create an Asset Manager ─────────────────────────────
  const assetManagerPassword = await bcrypt.hash('manager123', SALT_ROUNDS);
  const assetManager = await prisma.employee.upsert({
    where: { email: 'manager@assetflow.com' },
    update: {},
    create: {
      name: 'Asset Manager',
      email: 'manager@assetflow.com',
      passwordHash: assetManagerPassword,
      departmentId: createdDepts.find((d) => d.name === 'Operations')?.id || null,
      role: 'ASSET_MANAGER',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Asset Manager: ${assetManager.email} (password: manager123)`);

  // ── 6. Create a Department Head ────────────────────────────
  const deptHeadPassword = await bcrypt.hash('head123', SALT_ROUNDS);
  const deptHead = await prisma.employee.upsert({
    where: { email: 'enghead@assetflow.com' },
    update: {},
    create: {
      name: 'Engineering Head',
      email: 'enghead@assetflow.com',
      passwordHash: deptHeadPassword,
      departmentId: createdDepts.find((d) => d.name === 'Engineering')?.id || null,
      role: 'DEPARTMENT_HEAD',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Department Head: ${deptHead.email} (password: head123)`);

  // Assign as head of Engineering
  const engDept = createdDepts.find((d) => d.name === 'Engineering');
  if (engDept) {
    await prisma.department.update({
      where: { id: engDept.id },
      data: { headEmployeeId: deptHead.id },
    });
  }

  // ── 7. Create Sample Assets ────────────────────────────────
  const electronicsCategory = createdCategories.find((c) => c.name === 'Electronics');
  const furnitureCategory = createdCategories.find((c) => c.name === 'Furniture');
  const roomCategory = createdCategories.find((c) => c.name === 'Conference Rooms');

  const assets = [
    { name: 'MacBook Pro 16"', categoryId: electronicsCategory?.id, condition: 'NEW', location: 'Floor 3, Rack A', isBookable: false },
    { name: 'MacBook Air M2', categoryId: electronicsCategory?.id, condition: 'NEW', location: 'Floor 3, Rack A', isBookable: false },
    { name: 'Dell Monitor 27"', categoryId: electronicsCategory?.id, condition: 'GOOD', location: 'Floor 2, Storage', isBookable: false },
    { name: 'Standing Desk', categoryId: furnitureCategory?.id, condition: 'NEW', location: 'Floor 1', isBookable: false },
    { name: 'Ergonomic Chair', categoryId: furnitureCategory?.id, condition: 'GOOD', location: 'Floor 1', isBookable: false },
    { name: 'Conference Room A', categoryId: roomCategory?.id, condition: 'GOOD', location: 'Floor 2', isBookable: true },
    { name: 'Conference Room B', categoryId: roomCategory?.id, condition: 'GOOD', location: 'Floor 3', isBookable: true },
    { name: 'Meeting Pod 1', categoryId: roomCategory?.id, condition: 'NEW', location: 'Floor 1', isBookable: true },
  ];

  for (let i = 0; i < assets.length; i++) {
    const assetTag = `AF-${String(i + 1).padStart(4, '0')}`;
    const a = await prisma.asset.upsert({
      where: { assetTag },
      update: {},
      create: {
        ...assets[i],
        assetTag,
        status: 'AVAILABLE',
      },
    });
    console.log(`  ✅ Asset: ${a.assetTag} — ${a.name} (${a.isBookable ? 'bookable' : 'allocatable'})`);
  }

  console.log('\n🌱 Seeding complete!\n');
  console.log('  Login credentials:');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  Admin:          admin@assetflow.com / admin123  │');
  console.log('  │  Asset Manager:  manager@assetflow.com / manager123 │');
  console.log('  │  Dept Head:      enghead@assetflow.com / head123 │');
  console.log('  │  Employees:      priya@assetflow.com / employee123  │');
  console.log('  └─────────────────────────────────────────────────┘');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
