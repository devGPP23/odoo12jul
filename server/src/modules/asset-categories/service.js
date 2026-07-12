/**
 * Asset Categories Module — Service Layer.
 */

const { prisma } = require('../../config/postgres');
const AppError = require('../../utils/AppError');

async function createCategory({ name, customFields }) {
  return prisma.assetCategory.create({
    data: {
      name,
      customFields: customFields || null,
    },
  });
}

async function getAllCategories({ search } = {}) {
  const where = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  return prisma.assetCategory.findMany({
    where,
    include: {
      _count: { select: { assets: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function getCategoryById(id) {
  const category = await prisma.assetCategory.findUnique({
    where: { id },
    include: { _count: { select: { assets: true } } },
  });

  if (!category) throw new AppError('Asset category not found.', 404);
  return category;
}

async function updateCategory(id, { name, customFields }) {
  const category = await prisma.assetCategory.findUnique({ where: { id } });
  if (!category) throw new AppError('Asset category not found.', 404);

  return prisma.assetCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(customFields !== undefined && { customFields }),
    },
  });
}

async function deleteCategory(id) {
  const category = await prisma.assetCategory.findUnique({
    where: { id },
    include: { _count: { select: { assets: true } } },
  });

  if (!category) throw new AppError('Asset category not found.', 404);

  if (category._count.assets > 0) {
    throw new AppError(
      'Cannot delete a category that has assets. Reassign assets first.',
      400
    );
  }

  return prisma.assetCategory.delete({ where: { id } });
}

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
