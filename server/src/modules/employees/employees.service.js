const { PrismaClient } = require('@prisma/client');
const AppError = require('../../utils/AppError');
const { getRedisClient } = require('../../config/redis');
const eventBus = require('../../core/eventBus');

const prisma = new PrismaClient();

class EmployeesService {
  async getAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { name, departmentId, role, status } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (departmentId) where.departmentId = departmentId;
    if (role) where.role = role;
    if (status) where.status = status;

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          department: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.employee.count({ where })
    ]);

    return {
      data: employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async promote(employeeId, newRole, actorId) {
    const validRoles = ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'];
    if (!validRoles.includes(newRole)) {
      throw new AppError('Invalid role specified', 400);
    }

    const targetEmployee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!targetEmployee) {
      throw new AppError('Employee not found', 404);
    }

    if (targetEmployee.role === newRole) {
      return targetEmployee; // Nothing to change
    }

    // A2 (last admin check)
    if (targetEmployee.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await prisma.employee.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (adminCount <= 1) {
        throw new AppError('Cannot demote the last remaining active ADMIN.', 400);
      }
    }

    // Proceed with promotion
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { role: newRole },
      select: {
        id: true, name: true, email: true, role: true, departmentId: true
      }
    });

    // A1 (Redis invalidation / force logout)
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`refresh:${employeeId}`);
    }

    eventBus.emit('entity.action', {
      type: 'employee.role_changed',
      actorId,
      entityType: 'employee',
      entityId: employeeId,
      data: { oldRole: targetEmployee.role, newRole },
      timestamp: new Date().toISOString()
    });

    return updated;
  }
}

module.exports = new EmployeesService();
