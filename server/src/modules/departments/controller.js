/**
 * Departments Module — Controller.
 */

const asyncHandler = require('../../utils/asyncHandler');
const departmentService = require('./service');

const create = asyncHandler(async (req, res) => {
  const dept = await departmentService.createDepartment(req.body);
  res.locals.createdEntityId = dept.id;
  res.status(201).json({ success: true, data: dept });
});

const getAll = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const departments = await departmentService.getAllDepartments({ status, search });
  res.json({ success: true, data: departments });
});

const getById = asyncHandler(async (req, res) => {
  const dept = await departmentService.getDepartmentById(req.params.id);
  res.json({ success: true, data: dept });
});

const update = asyncHandler(async (req, res) => {
  const dept = await departmentService.updateDepartment(req.params.id, req.body);
  res.json({ success: true, data: dept });
});

const remove = asyncHandler(async (req, res) => {
  await departmentService.deleteDepartment(req.params.id);
  res.json({ success: true, message: 'Department deactivated.' });
});

const assignHead = asyncHandler(async (req, res) => {
  const dept = await departmentService.assignHead(req.params.id, req.body.headEmployeeId);
  res.json({ success: true, data: dept });
});

module.exports = { create, getAll, getById, update, remove, assignHead };
