const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Preference = require('../models/Preference');
const User = require('../models/User');
const Allocation = require('../models/Allocation');
const { ObjectId } = require('mongodb');

const router = express.Router();

// Get all custom titles with status (Admin only)
router.get('/', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const preferences = await Preference.getAll();
        const students = await User.getAllByRole('student');
        const supervisors = await User.getAllByRole('supervisor');

        const customTitles = preferences
            .filter(pref => pref.customTitle && pref.customTitle.title)
            .map(pref => {
                const student = students.find(s => s._id.toString() === pref.studentId.toString());
                const approvedSupervisor = pref.customTitle.approvedSupervisorId ?
                    supervisors.find(s => s._id.toString() === pref.customTitle.approvedSupervisorId.toString()) : null;

                return {
                    studentId: pref.studentId,
                    studentName: student ? student.name : 'Unknown',
                    studentUsername: student ? student.username : 'Unknown',
                    customTitle: pref.customTitle.title,
                    preferredSupervisor: pref.customTitle.supervisorName,
                    preferredSupervisorUsername: pref.customTitle.supervisorUsername,
                    status: pref.customTitle.status || 'pending',
                    approvedSupervisorId: pref.customTitle.approvedSupervisorId,
                    approvedSupervisorName: approvedSupervisor ? approvedSupervisor.name : null,
                    rejectedReason: pref.customTitle.rejectedReason,
                    submittedAt: pref.submittedAt,
                    approvedAt: pref.customTitle.approvedAt
                };
            });

        res.json(customTitles);
    } catch (error) {
        console.error('Error fetching custom titles:', error);
        res.status(500).json({ message: 'Error fetching custom titles' });
    }
});

// Approve custom title (Admin only) - WITH CAPACITY CHECK
router.post('/:studentId/approve', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const { studentId } = req.params;
        const { supervisorId } = req.body;

        if (!supervisorId) {
            return res.status(400).json({ message: 'Supervisor ID is required' });
        }

        // Verify supervisor exists
        const supervisor = await User.findById(supervisorId);
        if (!supervisor || supervisor.role !== 'supervisor') {
            return res.status(400).json({ message: 'Invalid supervisor' });
        }

        // Check supervisor current allocation count
        const currentAllocations = await Allocation.findBySupervisor(supervisorId);
        const currentCount = currentAllocations ? currentAllocations.length : 0;
        const supervisorCapacity = supervisor.capacity || 0;

        // If supervisor is at capacity, return error with current allocation info
        if (currentCount >= supervisorCapacity) {
            const allocationDetails = currentAllocations ? currentAllocations.map(a => ({
                studentName: a.studentName,
                studentId: a.studentUsername,
                title: a.title,
                isCustomTitle: a.isCustomTitle
            })) : [];

            return res.status(400).json({
                message: `Supervisor ${supervisor.name} has reached capacity (${currentCount}/${supervisorCapacity})`,
                supervisorName: supervisor.name,
                currentCount,
                capacity: supervisorCapacity,
                currentAllocations: allocationDetails,
                needsDecision: true
            });
        }

        // If supervisor has capacity, approve normally
        await Preference.updateCustomTitleStatus(studentId, 'approved', supervisorId);

        res.json({
            message: 'Custom title approved successfully',
            supervisorName: supervisor.name,
            currentCount: currentCount + 1,
            capacity: supervisorCapacity
        });
    } catch (error) {
        console.error('Error approving custom title:', error);
        res.status(500).json({ message: 'Error approving custom title' });
    }
});

// Reject custom title (Admin only)
router.post('/:studentId/reject', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const { studentId } = req.params;
        const { reason } = req.body;

        await Preference.updateCustomTitleStatus(studentId, 'rejected', null, reason || 'No reason provided');

        res.json({ message: 'Custom title rejected successfully' });
    } catch (error) {
        console.error('Error rejecting custom title:', error);
        res.status(500).json({ message: 'Error rejecting custom title' });
    }
});

module.exports = router;