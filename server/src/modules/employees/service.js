/**
 * Employees Module — Service Layer.
 * The promote() function is THE ONLY place in the entire codebase
 * that writes to Employee.role after signup.
 */

const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');
const { sendNotification } = require('../notifications/notificationService');

async function getAllEmployees({ departmentId, role, status, search, page = 1, limit = 50 } = {}) {
  const where = {};
  if (departmentId) where.departmentId = departmentId;
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return { employees, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getEmployeeById(id) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!employee) throw new AppError('Employee not found.', 404);
  return employee;
}

async function updateEmployee(id, { name, email, departmentId, status }) {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new AppError('Employee not found.', 404);

  // NOTE: role is NOT updatable here — only via promote()
  return prisma.employee.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(departmentId !== undefined && { departmentId }),
      ...(status !== undefined && { status }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
  });
}

/**
 * Promote an employee to a different role.
 * THIS IS THE ONLY ENDPOINT THAT WRITES Employee.role.
 * Guarded by requireRole(['ADMIN']) at the route level.
 *
 * @param {string} id - Employee ID
 * @param {string} role - 'DEPARTMENT_HEAD' | 'ASSET_MANAGER' | 'EMPLOYEE'
 * @param {string} adminId - The admin performing the promotion
 */
async function promoteEmployee(id, role, adminId) {
  const validRoles = ['DEPARTMENT_HEAD', 'ASSET_MANAGER', 'EMPLOYEE'];
  if (!validRoles.includes(role)) {
    throw new AppError(
      `Invalid role. Allowed values: ${validRoles.join(', ')}`,
      400
    );
  }

  // Admin cannot demote another admin (only self if needed)
  const target = await prisma.employee.findUnique({ where: { id } });
  if (!target) throw new AppError('Employee not found.', 404);

  if (target.role === 'ADMIN' && id !== adminId) {
    throw new AppError('Cannot change the role of another admin.', 403);
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
    },
  });

  // Fire-and-forget notification
  sendNotification({
    userId: id,
    type: 'ROLE_PROMOTED',
    message: `Your role has been updated to ${role.replace(/_/g, ' ')}.`,
    relatedEntityId: id,
    relatedEntityType: 'employee',
  });

  return updated;
}

module.exports = {
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  promoteEmployee,
};
