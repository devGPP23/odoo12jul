const categoriesService = require('./categories.service');
const asyncHandler = require('../../utils/asyncHandler');

class CategoriesController {
  create = asyncHandler(async (req, res) => {
    const result = await categoriesService.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: result,
    });
  });

  getAll = asyncHandler(async (req, res) => {
    const result = await categoriesService.getAll();
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await categoriesService.getById(id);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await categoriesService.update(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: result,
    });
  });

  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await categoriesService.delete(id);
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  });
}

module.exports = new CategoriesController();
