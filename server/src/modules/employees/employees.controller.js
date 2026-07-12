const employeesService = require('./employees.service');
const asyncHandler = require('../../utils/asyncHandler');

class EmployeesController {
  getAll = asyncHandler(async (req, res) => {
    const { name, departmentId, role, status, page = 1, limit = 20 } = req.query;
    
    const filters = { name, departmentId, role, status };
    const pagination = { page, limit };

    const result = await employeesService.getAll(filters, pagination);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  promote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    // Actor ID comes from JWT
    const actorId = req.user.id;

    const result = await employeesService.promote(id, role, actorId);
    
    res.status(200).json({
      success: true,
      message: 'Employee role updated successfully',
      data: result,
    });
  });
}

module.exports = new EmployeesController();
