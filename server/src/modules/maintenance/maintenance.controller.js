const maintenanceService = require('./maintenance.service');
const asyncHandler = require('../../utils/asyncHandler');

class MaintenanceController {
  raiseRequest = asyncHandler(async (req, res) => {
    const { assetId, asset_id, issueDescription, issue_description, priority, photoUrl, photo_url } = req.body;
    const raisedById = req.user.id; // From JWT

    const targetAssetId = assetId || asset_id;
    const targetDescription = issueDescription || issue_description;
    const targetPhotoUrl = photoUrl || photo_url;

    const request = await maintenanceService.raiseRequest({
      assetId: targetAssetId,
      raisedById,
      issueDescription: targetDescription,
      priority,
      photoUrl: targetPhotoUrl
    });

    res.status(201).json({
      success: true,
      message: 'Maintenance request raised successfully',
      data: request
    });
  });

  approve = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const approvedById = req.user.id; // From JWT

    const request = await maintenanceService.approveRequest(id, approvedById);

    res.status(200).json({
      success: true,
      message: 'Maintenance request approved successfully',
      data: request
    });
  });

  reject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const approvedById = req.user.id; // From JWT

    const request = await maintenanceService.rejectRequest(id, approvedById);

    res.status(200).json({
      success: true,
      message: 'Maintenance request rejected successfully',
      data: request
    });
  });

  assignTechnician = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { technicianId, technician_id } = req.body;

    const targetTechId = technicianId || technician_id;

    const request = await maintenanceService.assignTechnician(id, targetTechId);

    res.status(200).json({
      success: true,
      message: 'Technician assigned successfully',
      data: request
    });
  });

  startProgress = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await maintenanceService.startProgress(id);

    res.status(200).json({
      success: true,
      message: 'Maintenance task marked in progress',
      data: request
    });
  });

  resolve = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await maintenanceService.resolveRequest(id);

    res.status(200).json({
      success: true,
      message: 'Maintenance request resolved successfully',
      data: request
    });
  });

  getAll = asyncHandler(async (req, res) => {
    const { assetId, status, priority, raisedById, page = 1, limit = 20 } = req.query;

    const result = await maintenanceService.getAll(
      { assetId, status, priority, raisedById },
      { page, limit }
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });
}

module.exports = new MaintenanceController();
