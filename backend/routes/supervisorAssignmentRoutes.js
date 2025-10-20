const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Allocation = require('../models/Allocation');
const User = require('../models/User');

const router = express.Router();

// Helper function to calculate real-time supervisor capacity
const calculateSupervisorCapacity = async (supervisors) => {
    const supervisorCapacity = [];
    
    for (const supervisor of supervisors) {
        const allocations = await Allocation.findBySupervisor(supervisor._id);
        const currentCount = allocations ? allocations.length : 0;
        const capacity = supervisor.capacity || 0;
        
        supervisorCapacity.push({
            supervisor: supervisor,
            current: currentCount,
            capacity: capacity,
            remaining: capacity - currentCount
        });
    }
    
    return supervisorCapacity;
};

// Get allocations needing supervisor assignment
router.get('/needs-supervisor', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const allocations = await Allocation.getNeedsSupervisor();
        const supervisors = await User.getAllByRole('supervisor');
        
        // Calculate REAL-TIME supervisor capacity
        const supervisorCapacity = await calculateSupervisorCapacity(supervisors);

        res.json({
            allocations,
            supervisors: supervisorCapacity
        });
    } catch (error) {
        console.error('Error fetching allocations needing supervisor:', error);
        res.status(500).json({ message: 'Error fetching data' });
    }
});

// Assign supervisor to allocation
router.post('/:allocationId/assign-supervisor', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const { allocationId } = req.params;
        const { supervisorId } = req.body;

        if (!supervisorId) {
            return res.status(400).json({ message: 'Supervisor ID is required' });
        }

        // Verify supervisor exists
        const supervisor = await User.findById(supervisorId);
        if (!supervisor || supervisor.role !== 'supervisor') {
            return res.status(400).json({ message: 'Invalid supervisor' });
        }

        // Check supervisor capacity with REAL-TIME data
        const supervisorAllocations = await Allocation.findBySupervisor(supervisorId);
        const currentCount = supervisorAllocations ? supervisorAllocations.length : 0;
        const supervisorCapacity = supervisor.capacity || 0;

        if (currentCount >= supervisorCapacity) {
            return res.status(400).json({ 
                message: `Supervisor ${supervisor.name} has reached capacity (${currentCount}/${supervisorCapacity})` 
            });
        }

        // Get allocation before update for notification
        const allocationBeforeUpdate = await Allocation.findById(allocationId);

        // Update allocation
        await Allocation.updateSupervisor(allocationId, supervisorId, supervisor.name);

        // Get updated allocation for response
        const updatedAllocation = await Allocation.findById(allocationId);

        res.json({ 
            message: 'Supervisor assigned successfully',
            supervisorName: supervisor.name,
            allocation: updatedAllocation,
            previousSupervisor: allocationBeforeUpdate.supervisorName
        });
    } catch (error) {
        console.error('Error assigning supervisor:', error);
        res.status(500).json({ message: 'Error assigning supervisor' });
    }
});

// Auto-assign supervisors to all pending allocations
router.post('/auto-assign', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const allocations = await Allocation.getNeedsSupervisor();
        const supervisors = await User.getAllByRole('supervisor');
        
        let assignedCount = 0;
        const results = [];

        for (const allocation of allocations) {
            // Find supervisor with REAL-TIME remaining capacity
            let assigned = false;
            
            for (const supervisor of supervisors) {
                const supervisorAllocations = await Allocation.findBySupervisor(supervisor._id);
                const currentCount = supervisorAllocations ? supervisorAllocations.length : 0;
                const capacity = supervisor.capacity || 0;
                
                if (currentCount < capacity) {
                    await Allocation.updateSupervisor(
                        allocation._id, 
                        supervisor._id, 
                        supervisor.name
                    );
                    assignedCount++;
                    results.push({
                        student: allocation.studentName,
                        title: allocation.title,
                        supervisor: supervisor.name,
                        previousSupervisor: allocation.supervisorName
                    });
                    assigned = true;
                    break;
                }
            }
            
            if (!assigned) {
                results.push({
                    student: allocation.studentName,
                    title: allocation.title,
                    supervisor: 'No available supervisor',
                    error: 'No supervisor with remaining capacity found'
                });
            }
        }

        res.json({
            message: `Auto-assignment completed: ${assignedCount}/${allocations.length} allocations assigned`,
            assignedCount,
            totalNeeding: allocations.length,
            results
        });
    } catch (error) {
        console.error('Error in auto-assignment:', error);
        res.status(500).json({ message: 'Error during auto-assignment' });
    }
});

module.exports = router;