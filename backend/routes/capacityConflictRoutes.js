const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Preference = require('../models/Preference');
const Allocation = require('../models/Allocation');
const User = require('../models/User');
const { ObjectId } = require('mongodb');

const router = express.Router();

// Get capacity conflicts from the allocation process
router.get('/conflicts', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        // Get current allocations to understand supervisor utilization
        const allocations = await Allocation.getAll();
        const supervisors = await User.getAllByRole('supervisor');

        // Calculate current supervisor allocations
        const supervisorAllocations = new Map();
        supervisors.forEach(supervisor => {
            supervisorAllocations.set(supervisor._id.toString(), {
                count: 0,
                supervisor: supervisor,
                allocations: []
            });
        });

        // Count actual allocations for each supervisor
        allocations.forEach(allocation => {
            if (allocation.supervisorId) {
                const supervisorId = allocation.supervisorId.toString();
                if (supervisorAllocations.has(supervisorId)) {
                    const data = supervisorAllocations.get(supervisorId);
                    data.count++;
                    data.allocations.push(allocation);
                }
            }
        });

        // Get pending custom titles that need approval
        const pendingCustomTitles = await Preference.getByCustomTitleStatus('pending');
        const students = await User.getAllByRole('student');

        const conflicts = [];

        // Check capacity for pending custom titles
        for (const pref of pendingCustomTitles) {
            if (pref.customTitle && pref.customTitle.status === 'pending') {
                const student = students.find(s => s._id.toString() === pref.studentId.toString());
                let supervisor;

                if (pref.customTitle.supervisorUsername) {
                    supervisor = await User.findByUsername(pref.customTitle.supervisorUsername);
                } else {
                    supervisor = supervisors.find(s => s.name === pref.customTitle.supervisorName);
                }

                if (supervisor && student) {
                    const supervisorId = supervisor._id.toString();
                    const allocationData = supervisorAllocations.get(supervisorId);
                    const currentAllocations = allocationData ? allocationData.count : 0;
                    const supervisorCapacity = supervisor.capacity || 0;

                    // If supervisor is at or near capacity, flag as potential conflict
                    if (currentAllocations >= supervisorCapacity) {
                        conflicts.push({
                            studentId: pref.studentId,
                            studentName: student.name,
                            studentUsername: student.username,
                            customTitle: pref.customTitle.title,
                            preferredSupervisorId: supervisor._id,
                            preferredSupervisorName: supervisor.name,
                            supervisorCapacity: supervisorCapacity,
                            supervisorCurrent: currentAllocations,
                            conflictType: 'CAPACITY_CONSTRAINT',
                            preferenceData: pref,
                            status: 'pending_decision'
                        });
                    }
                }
            }
        }

        // Also include supervisors who are over capacity from current allocations
        const overCapacitySupervisors = Array.from(supervisorAllocations.values()).filter(data =>
            data.count > data.supervisor.capacity
        );

        overCapacitySupervisors.forEach(data => {
            conflicts.push({
                supervisorId: data.supervisor._id,
                supervisorName: data.supervisor.name,
                supervisorCapacity: data.supervisor.capacity,
                supervisorCurrent: data.count,
                conflictType: 'OVER_CAPACITY',
                allocations: data.allocations,
                status: 'requires_reallocation'
            });
        });

        // Return supervisor data for the frontend
        const supervisorData = Array.from(supervisorAllocations.values()).map(data => ({
            supervisorId: data.supervisor._id,
            supervisorName: data.supervisor.name,
            capacity: data.supervisor.capacity || 0,
            currentAllocations: data.count,
            remainingCapacity: Math.max(0, (data.supervisor.capacity || 0) - data.count),
            allocations: data.allocations.map(a => ({
                studentName: a.studentName,
                title: a.title,
                isCustomTitle: a.isCustomTitle
            }))
        }));

        res.json({
            conflicts: conflicts,
            supervisors: supervisorData
        });
    } catch (error) {
        console.error('Error fetching capacity conflicts:', error);
        res.status(500).json({ message: 'Error fetching capacity conflicts' });
    }
});

// Resolve capacity conflict and trigger re-allocation if needed
router.post('/resolve', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const { studentId, action, newSupervisorId, rejectReason } = req.body;

        if (!studentId || !action) {
            return res.status(400).json({ message: 'Student ID and action are required' });
        }

        const preference = await Preference.findByStudent(studentId);
        if (!preference || !preference.customTitle) {
            return res.status(404).json({ message: 'Student preference or custom title not found' });
        }

        if (action === 'reassign') {
            if (!newSupervisorId) {
                return res.status(400).json({ message: 'New supervisor ID is required for reassignment' });
            }

            const newSupervisor = await User.findById(newSupervisorId);
            if (!newSupervisor || newSupervisor.role !== 'supervisor') {
                return res.status(400).json({ message: 'Invalid supervisor' });
            }

            // Check if new supervisor has capacity
            const currentAllocations = await Allocation.findBySupervisor(newSupervisorId);
            const currentCount = currentAllocations ? currentAllocations.length : 0;
            const supervisorCapacity = newSupervisor.capacity || 0;

            if (currentCount >= supervisorCapacity) {
                return res.status(400).json({
                    message: `New supervisor ${newSupervisor.name} has no capacity (${currentCount}/${supervisorCapacity})`
                });
            }

            // Reassign to new supervisor
            await Preference.updateCustomTitleStatus(studentId, 'approved', newSupervisorId);

            res.json({
                message: `Custom title reassigned to ${newSupervisor.name}`,
                supervisorName: newSupervisor.name,
                needsReallocation: true
            });

        } else if (action === 'reject') {
            // Reject the custom title
            await Preference.updateCustomTitleStatus(studentId, 'rejected', null, rejectReason || 'Capacity constraints');

            res.json({
                message: 'Custom title rejected due to capacity constraints',
                studentWillUseRegularPreferences: true,
                needsReallocation: true
            });
        } else if (action === 'approve_with_override') {
            // Force approve even if at capacity (admin override)
            const supervisor = await User.findById(preference.customTitle.approvedSupervisorId);
            await Preference.updateCustomTitleStatus(studentId, 'approved', preference.customTitle.approvedSupervisorId);

            res.json({
                message: `Custom title force-approved for ${supervisor.name} (capacity override)`,
                supervisorName: supervisor.name,
                isCapacityOverride: true
            });
        } else {
            return res.status(400).json({ message: 'Invalid action. Use "reassign", "reject", or "approve_with_override".' });
        }
    } catch (error) {
        console.error('Error resolving capacity conflict:', error);
        res.status(500).json({ message: 'Error resolving capacity conflict' });
    }
});

// Get available supervisors with capacity
router.get('/available-supervisors', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const supervisors = await User.getAllByRole('supervisor');
        const availableSupervisors = [];

        for (const supervisor of supervisors) {
            const allocations = await Allocation.findBySupervisor(supervisor._id);
            const currentCount = allocations ? allocations.length : 0;
            const capacity = supervisor.capacity || 0;

            if (currentCount < capacity) {
                availableSupervisors.push({
                    supervisorId: supervisor._id,
                    supervisorName: supervisor.name,
                    currentAllocations: currentCount,
                    capacity: capacity,
                    remainingCapacity: capacity - currentCount
                });
            }
        }

        // Sort by remaining capacity (highest first)
        availableSupervisors.sort((a, b) => b.remainingCapacity - a.remainingCapacity);

        res.json(availableSupervisors);
    } catch (error) {
        console.error('Error fetching available supervisors:', error);
        res.status(500).json({ message: 'Error fetching available supervisors' });
    }
});

module.exports = router;