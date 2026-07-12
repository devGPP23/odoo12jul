/**
 * Employees Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const employeeService = require('./service');

const getAll = asyncHandler(async (req, res) => {
  const { departmentId, role, status, search, page, limit } = req.query;
  const result = await employeeService.getAllEmployees({
    departmentId,
    role,
    status,
    search,
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });
  res.json({ success: true, data: result });
});

const getById = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployeeById(req.params.id);
  res.json({ success: true, data: employee });
});

const update = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body);
  res.json({ success: true, data: employee });
});

const promote = asyncHandler(async (req, res) => {
  const employee = await employeeService.promoteEmployee(
    req.params.id,
    req.body.role,
    req.user.id
  );
  res.json({ success: true, data: employee });
});

module.exports = { getAll, getById, update, promote };
