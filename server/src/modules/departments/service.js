/**
 * Departments Module — Service Layer.
 */

const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');

async function createDepartment({ name, parentDepartmentId, status }) {
  // Validate parent if provided
  if (parentDepartmentId) {
    const parent = await prisma.department.findUnique({ where: { id: parentDepartmentId } });
    if (!parent) throw new AppError('Parent department not found.', 404);
  }

  return prisma.department.create({
    data: {
      name,
      parentDepartmentId: parentDepartmentId || null,
      status: status || 'ACTIVE',
    },
    include: {
      parentDepartment: { select: { id: true, name: true } },
      headEmployee: { select: { id: true, name: true, email: true } },
    },
  });
}

async function getAllDepartments({ status, search } = {}) {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  return prisma.department.findMany({
    where,
    include: {
      parentDepartment: { select: { id: true, name: true } },
      headEmployee: { select: { id: true, name: true, email: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function getDepartmentById(id) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      parentDepartment: { select: { id: true, name: true } },
      headEmployee: { select: { id: true, name: true, email: true } },
      childDepartments: { select: { id: true, name: true, status: true } },
      employees: {
        select: { id: true, name: true, email: true, role: true, status: true },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!dept) throw new AppError('Department not found.', 404);
  return dept;
}

async function updateDepartment(id, { name, parentDepartmentId, status }) {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new AppError('Department not found.', 404);

  // Prevent circular parent reference
  if (parentDepartmentId === id) {
    throw new AppError('A department cannot be its own parent.', 400);
  }

  return prisma.department.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(parentDepartmentId !== undefined && { parentDepartmentId }),
      ...(status !== undefined && { status }),
    },
    include: {
      parentDepartment: { select: { id: true, name: true } },
      headEmployee: { select: { id: true, name: true, email: true } },
    },
  });
}

async function deleteDepartment(id) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });

  if (!dept) throw new AppError('Department not found.', 404);

  if (dept._count.employees > 0) {
    throw new AppError(
      'Cannot delete a department with active employees. Reassign or deactivate them first.',
      400
    );
  }

  // Soft delete: set to INACTIVE rather than hard delete
  return prisma.department.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });
}

async function assignHead(departmentId, headEmployeeId) {
  const [dept, employee] = await Promise.all([
    prisma.department.findUnique({ where: { id: departmentId } }),
    prisma.employee.findUnique({ where: { id: headEmployeeId } }),
  ]);

  if (!dept) throw new AppError('Department not found.', 404);
  if (!employee) throw new AppError('Employee not found.', 404);

  return prisma.department.update({
    where: { id: departmentId },
    data: { headEmployeeId },
    include: {
      headEmployee: { select: { id: true, name: true, email: true } },
    },
  });
}

module.exports = {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  assignHead,
};
