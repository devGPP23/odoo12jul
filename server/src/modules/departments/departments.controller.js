const departmentsService = require('./departments.service');
const asyncHandler = require('../../utils/asyncHandler');

class DepartmentsController {
  create = asyncHandler(async (req, res) => {
    const result = await departmentsService.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: result,
    });
  });

  getAll = asyncHandler(async (req, res) => {
    const result = await departmentsService.getAll();
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await departmentsService.getById(id);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await departmentsService.update(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: result,
    });
  });

  assignHead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { employeeId } = req.body;
    const result = await departmentsService.assignHead(id, employeeId);
    res.status(200).json({
      success: true,
      message: 'Department head assigned successfully',
      data: result,
    });
  });
}

module.exports = new DepartmentsController();
