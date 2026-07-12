const { PrismaClient } = require('@prisma/client');
const AppError = require('../../utils/AppError');
const eventBus = require('../../core/eventBus');

const prisma = new PrismaClient();

class DepartmentsService {
  async create(data) {
    const { name, parentDepartmentId } = data;

    // Check unique name
    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) {
      throw new AppError('Department name must be unique', 409);
    }

    if (parentDepartmentId) {
      const parent = await prisma.department.findUnique({ where: { id: parentDepartmentId } });
      if (!parent || parent.status !== 'ACTIVE') {
        throw new AppError('Invalid or inactive parent department', 400);
      }
    }

    const dept = await prisma.department.create({
      data: { name, parentDepartmentId },
    });

    eventBus.emit('entity.action', {
      type: 'department.created',
      entityType: 'department',
      entityId: dept.id,
      data: { name: dept.name },
      timestamp: new Date().toISOString()
    });

    return dept;
  }

  async getAll() {
    return prisma.department.findMany({
      include: {
        parentDepartment: { select: { id: true, name: true } },
        headEmployee: { select: { id: true, name: true, email: true } },
      }
    });
  }

  async getById(id) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        childDepartments: { select: { id: true, name: true } },
        employees: { select: { id: true, name: true, role: true } },
        headEmployee: { select: { id: true, name: true, email: true } },
      }
    });

    if (!dept) throw new AppError('Department not found', 404);
    return dept;
  }

  async update(id, data) {
    const { name, parentDepartmentId, status } = data;
    
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) throw new AppError('Department not found', 404);

    if (name && name !== dept.name) {
      const existing = await prisma.department.findUnique({ where: { name } });
      if (existing) throw new AppError('Department name must be unique', 409);
    }

    // D1 (circular check): Ensure a department cannot be its own parent or a descendant's child
    if (parentDepartmentId) {
      if (parentDepartmentId === id) {
        throw new AppError('Department cannot be its own parent', 400);
      }
      let currentParent = await prisma.department.findUnique({ where: { id: parentDepartmentId } });
      while (currentParent) {
        if (currentParent.id === id) {
          throw new AppError('Circular reference detected in hierarchy', 400);
        }
        if (!currentParent.parentDepartmentId) break;
        currentParent = await prisma.department.findUnique({ where: { id: currentParent.parentDepartmentId } });
      }
    }

    // D2 (deactivation check): Cannot deactivate if it has active employees or active child departments
    if (status === 'INACTIVE' && dept.status !== 'INACTIVE') {
      const activeChildren = await prisma.department.count({
        where: { parentDepartmentId: id, status: 'ACTIVE' }
      });
      if (activeChildren > 0) throw new AppError('Cannot deactivate department with active child departments', 400);

      const activeEmployees = await prisma.employee.count({
        where: { departmentId: id, status: 'ACTIVE' }
      });
      if (activeEmployees > 0) throw new AppError('Cannot deactivate department with active employees', 400);
    }

    const updated = await prisma.department.update({
      where: { id },
      data: { name, parentDepartmentId, status },
    });

    eventBus.emit('entity.action', {
      type: 'department.updated',
      entityType: 'department',
      entityId: updated.id,
      data: { status: updated.status },
      timestamp: new Date().toISOString()
    });

    return updated;
  }

  async assignHead(id, employeeId) {
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) throw new AppError('Department not found', 404);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.status !== 'ACTIVE') {
      throw new AppError('Employee not found or inactive', 404);
    }

    // D3 (old head role reset): Reset old head to EMPLOYEE if they are not head of any other department
    return prisma.$transaction(async (tx) => {
      const oldHeadId = dept.headEmployeeId;
      
      const updatedDept = await tx.department.update({
        where: { id },
        data: { headEmployeeId: employeeId }
      });

      // Promote new head
      if (employee.role === 'EMPLOYEE') {
        await tx.employee.update({
          where: { id: employeeId },
          data: { role: 'DEPT_HEAD' }
        });
      }

      // Check if old head needs demotion
      if (oldHeadId && oldHeadId !== employeeId) {
        const otherDepts = await tx.department.count({
          where: { headEmployeeId: oldHeadId, status: 'ACTIVE', id: { not: id } }
        });
        
        if (otherDepts === 0) {
          const oldHead = await tx.employee.findUnique({ where: { id: oldHeadId } });
          // Only demote if they were just a DEPT_HEAD (not an ADMIN)
          if (oldHead.role === 'DEPT_HEAD') {
            await tx.employee.update({
              where: { id: oldHeadId },
              data: { role: 'EMPLOYEE' }
            });
          }
        }
      }

      eventBus.emit('entity.action', {
        type: 'department.head_assigned',
        entityType: 'department',
        entityId: updatedDept.id,
        actorId: null, // this will be enriched by controller if possible
        data: { newHeadId: employeeId, oldHeadId },
        timestamp: new Date().toISOString()
      });

      return updatedDept;
    });
  }
}

module.exports = new DepartmentsService();
