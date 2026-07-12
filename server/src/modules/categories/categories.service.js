const { PrismaClient } = require('@prisma/client');
const AppError = require('../../utils/AppError');

const prisma = new PrismaClient();

class CategoriesService {
  async create(data) {
    const { name, customFields } = data;

    const existing = await prisma.assetCategory.findUnique({ where: { name } });
    if (existing) {
      throw new AppError('Category name must be unique', 409);
    }

    return prisma.assetCategory.create({
      data: { name, customFields: customFields || {} },
    });
  }

  async getAll() {
    return prisma.assetCategory.findMany({
      include: {
        _count: {
          select: { assets: true }
        }
      }
    });
  }

  async getById(id) {
    const category = await prisma.assetCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assets: true }
        }
      }
    });

    if (!category) throw new AppError('Category not found', 404);
    return category;
  }

  async update(id, data) {
    const { name, customFields } = data;
    
    const category = await prisma.assetCategory.findUnique({ where: { id } });
    if (!category) throw new AppError('Category not found', 404);

    if (name && name !== category.name) {
      const existing = await prisma.assetCategory.findUnique({ where: { name } });
      if (existing) throw new AppError('Category name must be unique', 409);
    }

    return prisma.assetCategory.update({
      where: { id },
      data: { name, customFields },
    });
  }

  async delete(id) {
    const category = await prisma.assetCategory.findUnique({ 
      where: { id },
      include: {
        _count: { select: { assets: true } }
      }
    });
    
    if (!category) throw new AppError('Category not found', 404);

    if (category._count.assets > 0) {
      throw new AppError('Cannot delete category because it has attached assets', 400);
    }

    return prisma.assetCategory.delete({ where: { id } });
  }
}

module.exports = new CategoriesService();
