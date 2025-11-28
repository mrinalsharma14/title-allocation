// const Allocation = require('../models/Allocation');
// const User = require('../models/User');
// const { ObjectId } = require('mongodb');

// class SecondMarkerAssignment {
//     constructor(allocations, supervisors) {
//         this.allocations = allocations;
//         this.supervisors = supervisors;
//         this.supervisorMap = new Map();
//         this.assignments = new Map(); // studentId -> secondMarkerId
//         this.supervisorWorkload = new Map(); // supervisorId -> { supervisionCount: number, secondMarkingCount: number }
//         this.supervisorPairs = new Map(); // supervisorId -> Set of second markers they work with
//     }

//     initialize() {
//         // Calculate supervision count for each supervisor
//         this.supervisors.forEach(supervisor => {
//             const supervisorId = supervisor._id.toString();
//             const supervisionCount = this.allocations.filter(a => 
//                 a.supervisorId && a.supervisorId.toString() === supervisorId
//             ).length;

//             this.supervisorMap.set(supervisorId, supervisor);
//             this.supervisorWorkload.set(supervisorId, {
//                 supervisionCount: supervisionCount,
//                 secondMarkingCount: 0,
//                 remainingCapacity: supervisionCount // for second marking
//             });
//             this.supervisorPairs.set(supervisorId, new Set());
//         });
//     }

//     assignSecondMarkers() {
//         this.initialize();

//         // Group allocations by supervisor
//         const allocationsBySupervisor = new Map();
//         this.allocations.forEach(allocation => {
//             if (allocation.supervisorId) {
//                 const supervisorId = allocation.supervisorId.toString();
//                 if (!allocationsBySupervisor.has(supervisorId)) {
//                     allocationsBySupervisor.set(supervisorId, []);
//                 }
//                 allocationsBySupervisor.get(supervisorId).push(allocation);
//             }
//         });

//         // Create a list of all supervisor pairs and their potential assignments
//         const supervisorPairs = [];

//         for (const [supervisorId, allocations] of allocationsBySupervisor) {
//             const supervisorWorkload = this.supervisorWorkload.get(supervisorId);
//             const requiredSecondMarkings = supervisorWorkload.supervisionCount;

//             // Get potential second markers (all other supervisors with capacity)
//             const potentialMarkers = Array.from(this.supervisorWorkload.entries())
//                 .filter(([markerId, workload]) => 
//                     markerId !== supervisorId && 
//                     workload.remainingCapacity > 0
//                 )
//                 .map(([markerId, workload]) => ({
//                     markerId,
//                     remainingCapacity: workload.remainingCapacity,
//                     currentPairs: this.supervisorPairs.get(supervisorId).has(markerId) ? 1 : 0
//                 }));

//             // Sort by existing pairs first (to minimize new pairs), then by capacity
//             potentialMarkers.sort((a, b) => {
//                 if (b.currentPairs !== a.currentPairs) {
//                     return b.currentPairs - a.currentPairs; // Prefer existing pairs
//                 }
//                 return b.remainingCapacity - a.remainingCapacity; // Then by capacity
//             });

//             supervisorPairs.push({
//                 supervisorId,
//                 allocations,
//                 requiredSecondMarkings,
//                 potentialMarkers
//             });
//         }

//         // Sort supervisors by difficulty (fewest potential markers first)
//         supervisorPairs.sort((a, b) => a.potentialMarkers.length - b.potentialMarkers.length);

//         // Assign second markers using a greedy approach
//         for (const pair of supervisorPairs) {
//             this.assignForSupervisor(pair);
//         }

//         // Handle any remaining unassigned students
//         this.handleRemainingAssignments();

//         return this.getAssignmentResults();
//     }

//     assignForSupervisor({ supervisorId, allocations, requiredSecondMarkings, potentialMarkers }) {
//         let assignedCount = 0;

//         // Try to assign using existing pairs first
//         for (const allocation of allocations) {
//             if (assignedCount >= requiredSecondMarkings) break;

//             const existingPairs = Array.from(this.supervisorPairs.get(supervisorId));
//             const availableExisting = potentialMarkers.filter(marker => 
//                 existingPairs.includes(marker.markerId) && 
//                 marker.remainingCapacity > 0
//             );

//             if (availableExisting.length > 0) {
//                 const marker = availableExisting[0];
//                 this.assignStudent(allocation, marker.markerId);
//                 assignedCount++;
//                 marker.remainingCapacity--;
//             }
//         }

//         // Assign remaining using new markers if needed
//         for (const allocation of allocations) {
//             if (assignedCount >= requiredSecondMarkings) break;
//             if (this.assignments.has(allocation.studentId.toString())) continue;

//             const availableMarker = potentialMarkers.find(marker => marker.remainingCapacity > 0);
//             if (availableMarker) {
//                 this.assignStudent(allocation, availableMarker.markerId);
//                 assignedCount++;
//                 availableMarker.remainingCapacity--;
//             }
//         }
//     }

//     assignStudent(allocation, secondMarkerId) {
//         const studentId = allocation.studentId.toString();
//         const supervisorId = allocation.supervisorId.toString();

//         this.assignments.set(studentId, secondMarkerId);

//         // Update workload
//         const markerWorkload = this.supervisorWorkload.get(secondMarkerId);
//         markerWorkload.secondMarkingCount++;
//         markerWorkload.remainingCapacity--;

//         // Update pairs
//         this.supervisorPairs.get(supervisorId).add(secondMarkerId);
//         this.supervisorPairs.get(secondMarkerId).add(supervisorId);
//     }

//     handleRemainingAssignments() {
//         // Get unassigned students
//         const unassignedStudents = this.allocations.filter(allocation => 
//             !this.assignments.has(allocation.studentId.toString())
//         );

//         for (const allocation of unassignedStudents) {
//             const supervisorId = allocation.supervisorId.toString();

//             // Find any available second marker (not the supervisor themselves)
//             const availableMarker = Array.from(this.supervisorWorkload.entries())
//                 .find(([markerId, workload]) => 
//                     markerId !== supervisorId && 
//                     workload.remainingCapacity > 0
//                 );

//             if (availableMarker) {
//                 this.assignStudent(allocation, availableMarker[0]);
//             } else {
//                 console.warn(`Could not assign second marker for student: ${allocation.studentName}`);
//             }
//         }
//     }

//     getAssignmentResults() {
//         const results = [];
//         const statistics = {
//             totalAssignments: this.assignments.size,
//             supervisorPairStats: []
//         };

//         // Build results array
//         this.allocations.forEach(allocation => {
//             const studentId = allocation.studentId.toString();
//             const secondMarkerId = this.assignments.get(studentId);
//             const secondMarker = secondMarkerId ? this.supervisorMap.get(secondMarkerId) : null;

//             results.push({
//                 studentId: allocation.studentId,
//                 studentUsername: allocation.studentUsername,
//                 studentName: allocation.studentName,
//                 studentEmail: allocation.studentEmail, // We'll need to fetch this
//                 title: allocation.title,
//                 supervisorId: allocation.supervisorId,
//                 supervisorName: allocation.supervisorName,
//                 secondMarkerId: secondMarkerId,
//                 secondMarkerName: secondMarker ? secondMarker.name : 'Not Assigned'
//             });
//         });

//         // Calculate statistics
//         this.supervisorPairs.forEach((pairs, supervisorId) => {
//             const supervisor = this.supervisorMap.get(supervisorId);
//             const workload = this.supervisorWorkload.get(supervisorId);

//             statistics.supervisorPairStats.push({
//                 supervisorName: supervisor.name,
//                 supervisionCount: workload.supervisionCount,
//                 secondMarkingCount: workload.secondMarkingCount,
//                 uniquePairs: pairs.size,
//                 pairs: Array.from(pairs).map(markerId => this.supervisorMap.get(markerId).name)
//             });
//         });

//         return {
//             assignments: results,
//             statistics: statistics
//         };
//     }
// }

// // Controller function to assign second markers
// const assignSecondMarkers = async (req, res) => {
//     try {
//         const allocations = await Allocation.getAll();
//         const supervisors = await User.getAllByRole('supervisor');

//         // Filter allocations that have supervisors assigned
//         const supervisedAllocations = allocations.filter(a => a.supervisorId);

//         const assignmentEngine = new SecondMarkerAssignment(supervisedAllocations, supervisors);
//         const results = assignmentEngine.assignSecondMarkers();

//         res.json({
//             message: 'Second markers assigned successfully',
//             assignments: results.assignments,
//             statistics: results.statistics
//         });
//     } catch (error) {
//         console.error('Error assigning second markers:', error);
//         res.status(500).json({ message: 'Error assigning second markers: ' + error.message });
//     }
// };

// // Get second marker assignments
// const getSecondMarkerAssignments = async (req, res) => {
//     try {
//         // In a real implementation, you might want to store assignments in database
//         // For now, we'll calculate on the fly
//         const allocations = await Allocation.getAll();
//         const supervisors = await User.getAllByRole('supervisor');
//         const supervisedAllocations = allocations.filter(a => a.supervisorId);

//         const assignmentEngine = new SecondMarkerAssignment(supervisedAllocations, supervisors);
//         const results = assignmentEngine.assignSecondMarkers();

//         res.json(results.assignments);
//     } catch (error) {
//         console.error('Error fetching second marker assignments:', error);
//         res.status(500).json({ message: 'Error fetching second marker assignments' });
//     }
// };

// module.exports = {
//     assignSecondMarkers,
//     getSecondMarkerAssignments,
//     SecondMarkerAssignment
// };

// backend/controllers/secondMarkerController.js

const Allocation = require('../models/Allocation');
const User = require('../models/User');
const { ObjectId } = require('mongodb');

class SecondMarkerAssignment {
    constructor(allocations, supervisors) {
        this.allocations = allocations;
        this.supervisors = supervisors;
        this.supervisorMap = new Map();
        this.assignments = new Map(); // studentId -> secondMarkerId
        this.supervisorWorkload = new Map(); // supervisorId -> { supervisionCount: number, secondMarkingCount: number }
        this.supervisorPairs = new Map(); // supervisorId -> Map of secondMarkerId -> count
    }

    initialize() {
        // Calculate supervision count for each supervisor
        this.supervisors.forEach(supervisor => {
            const supervisorId = supervisor._id.toString();
            const supervisionCount = this.allocations.filter(a =>
                a.supervisorId && a.supervisorId.toString() === supervisorId
            ).length;

            this.supervisorMap.set(supervisorId, supervisor);
            this.supervisorWorkload.set(supervisorId, {
                supervisionCount: supervisionCount,
                secondMarkingCount: 0,
                targetSecondMarking: supervisionCount, // MUST match supervision count
                remainingCapacity: supervisionCount
            });
            this.supervisorPairs.set(supervisorId, new Map());
        });

        console.log('Initialized supervisor workloads:',
            Array.from(this.supervisorWorkload.entries()).map(([id, w]) =>
                `${this.supervisorMap.get(id).name}: Supervises ${w.supervisionCount}, Target: ${w.targetSecondMarking}`
            )
        );
    }

    assignSecondMarkers() {
        this.initialize();

        // Phase 1: Create optimal pairings to minimize unique pairs
        this.createOptimalPairings();

        // Phase 2: Assign students based on the optimal pairings
        this.assignStudentsToOptimalPairs();

        // Phase 3: Handle any remaining assignments
        this.handleRemainingAssignments();

        return this.getAssignmentResults();
    }

    createOptimalPairings() {
        const supervisors = Array.from(this.supervisorWorkload.entries())
            .filter(([_, workload]) => workload.supervisionCount > 0)
            .sort((a, b) => b[1].supervisionCount - a[1].supervisionCount);

        console.log('Creating optimal pairings for supervisors:', supervisors.map(([id, _]) => this.supervisorMap.get(id).name));

        // Try to pair supervisors in a way that minimizes unique pairs
        for (let i = 0; i < supervisors.length; i++) {
            const [supervisorId, workload] = supervisors[i];

            if (workload.remainingCapacity <= 0) continue;

            // Find best partner - prefer supervisors we're already paired with
            const bestPartner = this.findBestPartner(supervisorId, supervisors.slice(i + 1));

            if (bestPartner) {
                const [partnerId, partnerWorkload] = bestPartner;
                const swapCount = Math.min(workload.remainingCapacity, partnerWorkload.remainingCapacity);

                if (swapCount > 0) {
                    this.createPairing(supervisorId, partnerId, swapCount);
                    console.log(`Created pairing: ${this.supervisorMap.get(supervisorId).name} <-> ${this.supervisorMap.get(partnerId).name} (${swapCount} students)`);
                }
            }
        }
    }

    findBestPartner(supervisorId, potentialPartners) {
        const currentPairs = this.supervisorPairs.get(supervisorId);

        // First, try to reuse existing pairs
        for (const [partnerId, count] of currentPairs) {
            const partnerWorkload = this.supervisorWorkload.get(partnerId);
            if (partnerWorkload && partnerWorkload.remainingCapacity > 0) {
                const potentialPartner = potentialPartners.find(([id, _]) => id === partnerId);
                if (potentialPartner) {
                    return potentialPartner;
                }
            }
        }

        // If no existing pairs available, find partner with most remaining capacity
        return potentialPartners
            .filter(([id, workload]) =>
                id !== supervisorId &&
                workload.remainingCapacity > 0
            )
            .sort((a, b) => b[1].remainingCapacity - a[1].remainingCapacity)[0];
    }

    createPairing(supervisorId, partnerId, count) {
        // Update pair counts
        const supervisorPairs = this.supervisorPairs.get(supervisorId);
        const partnerPairs = this.supervisorPairs.get(partnerId);

        supervisorPairs.set(partnerId, (supervisorPairs.get(partnerId) || 0) + count);
        partnerPairs.set(supervisorId, (partnerPairs.get(supervisorId) || 0) + count);

        // Update workloads
        const supervisorWorkload = this.supervisorWorkload.get(supervisorId);
        const partnerWorkload = this.supervisorWorkload.get(partnerId);

        supervisorWorkload.remainingCapacity -= count;
        partnerWorkload.remainingCapacity -= count;
    }

    assignStudentsToOptimalPairs() {
        console.log('Assigning students to optimal pairs...');

        // Group allocations by supervisor
        const allocationsBySupervisor = new Map();
        this.allocations.forEach(allocation => {
            if (allocation.supervisorId) {
                const supervisorId = allocation.supervisorId.toString();
                if (!allocationsBySupervisor.has(supervisorId)) {
                    allocationsBySupervisor.set(supervisorId, []);
                }
                allocationsBySupervisor.get(supervisorId).push(allocation);
            }
        });

        // Assign students based on the optimal pairings
        for (const [supervisorId, pairs] of this.supervisorPairs) {
            const allocations = allocationsBySupervisor.get(supervisorId) || [];
            let allocationIndex = 0;

            for (const [partnerId, pairCount] of pairs) {
                // Assign students to this partner
                for (let i = 0; i < pairCount && allocationIndex < allocations.length; i++) {
                    const allocation = allocations[allocationIndex];
                    this.assignStudent(allocation, partnerId);
                    allocationIndex++;
                }
            }
        }
    }

    assignStudent(allocation, secondMarkerId) {
        const studentId = allocation.studentId.toString();
        const supervisorId = allocation.supervisorId.toString();

        this.assignments.set(studentId, secondMarkerId);

        // Update second marking count
        const markerWorkload = this.supervisorWorkload.get(secondMarkerId);
        markerWorkload.secondMarkingCount++;
    }

    handleRemainingAssignments() {
        // Get unassigned students
        const unassignedStudents = this.allocations.filter(allocation =>
            !this.assignments.has(allocation.studentId.toString())
        );

        console.log(`Handling ${unassignedStudents.length} remaining assignments`);

        if (unassignedStudents.length === 0) return;

        // Group unassigned by supervisor
        const unassignedBySupervisor = new Map();
        unassignedStudents.forEach(allocation => {
            const supervisorId = allocation.supervisorId.toString();
            if (!unassignedBySupervisor.has(supervisorId)) {
                unassignedBySupervisor.set(supervisorId, []);
            }
            unassignedBySupervisor.get(supervisorId).push(allocation);
        });

        // Assign remaining students, trying to minimize new pairs
        for (const [supervisorId, students] of unassignedBySupervisor) {
            const supervisorWorkload = this.supervisorWorkload.get(supervisorId);
            const neededAssignments = students.length;

            if (neededAssignments === 0) continue;

            // Find supervisors with remaining capacity (excluding self)
            const availableSupervisors = Array.from(this.supervisorWorkload.entries())
                .filter(([id, workload]) =>
                    id !== supervisorId &&
                    workload.secondMarkingCount < workload.targetSecondMarking
                )
                .sort((a, b) => {
                    // Prefer supervisors we already have pairs with
                    const aPairs = this.supervisorPairs.get(supervisorId).has(a[0]);
                    const bPairs = this.supervisorPairs.get(supervisorId).has(b[0]);
                    if (aPairs !== bPairs) return bPairs - aPairs;

                    // Then by remaining capacity
                    const aRemaining = a[1].targetSecondMarking - a[1].secondMarkingCount;
                    const bRemaining = b[1].targetSecondMarking - b[1].secondMarkingCount;
                    return bRemaining - aRemaining;
                });

            let assignedCount = 0;
            for (const [markerId, markerWorkload] of availableSupervisors) {
                const canAssign = Math.min(
                    neededAssignments - assignedCount,
                    markerWorkload.targetSecondMarking - markerWorkload.secondMarkingCount
                );

                if (canAssign > 0) {
                    // Assign students to this marker
                    for (let i = 0; i < canAssign && assignedCount < students.length; i++) {
                        this.assignStudent(students[assignedCount], markerId);
                        assignedCount++;
                    }

                    // Update pairing information
                    const supervisorPairs = this.supervisorPairs.get(supervisorId);
                    supervisorPairs.set(markerId, (supervisorPairs.get(markerId) || 0) + canAssign);

                    const markerPairs = this.supervisorPairs.get(markerId);
                    markerPairs.set(supervisorId, (markerPairs.get(supervisorId) || 0) + canAssign);

                    console.log(`Assigned ${canAssign} remaining students from ${this.supervisorMap.get(supervisorId).name} to ${this.supervisorMap.get(markerId).name}`);
                }

                if (assignedCount >= neededAssignments) break;
            }
        }
    }

    getAssignmentResults() {
        const results = [];
        const statistics = {
            totalAssignments: this.assignments.size,
            supervisorPairStats: [],
            pairingEfficiency: 0
        };

        // Build results array
        this.allocations.forEach(allocation => {
            const studentId = allocation.studentId.toString();
            const secondMarkerId = this.assignments.get(studentId);
            const secondMarker = secondMarkerId ? this.supervisorMap.get(secondMarkerId) : null;

            results.push({
                studentId: allocation.studentId,
                studentUsername: allocation.studentUsername,
                studentName: allocation.studentName,
                title: allocation.title,
                supervisorId: allocation.supervisorId,
                supervisorName: allocation.supervisorName,
                secondMarkerId: secondMarkerId,
                secondMarkerName: secondMarker ? secondMarker.name : 'Not Assigned'
            });
        });

        // Calculate statistics with STRICT enforcement
        let totalPairs = 0;
        let uniquePairs = 0;

        this.supervisorWorkload.forEach((workload, supervisorId) => {
            const supervisor = this.supervisorMap.get(supervisorId);
            const pairs = this.supervisorPairs.get(supervisorId);

            // Format pairs as readable strings instead of objects
            const pairStrings = Array.from(pairs.entries()).map(([markerId, count]) =>
                `${this.supervisorMap.get(markerId).name} (${count})`
            );

            // STRICT CHECK: Second marking must equal supervision count
            const isBalanced = workload.secondMarkingCount === workload.supervisionCount;

            if (!isBalanced) {
                console.warn(`IMBALANCE: ${supervisor.name} supervises ${workload.supervisionCount} but second marks ${workload.secondMarkingCount}`);
            }

            statistics.supervisorPairStats.push({
                supervisorName: supervisor.name,
                supervisionCount: workload.supervisionCount,
                secondMarkingCount: workload.secondMarkingCount,
                isBalanced: isBalanced,
                uniquePairs: pairs.size,
                pairs: pairStrings, // Now this is an array of strings, not objects
                pairDetails: Array.from(pairs.entries()).map(([markerId, count]) => ({
                    markerName: this.supervisorMap.get(markerId).name,
                    count: count
                })) // Keep structured data if needed for detailed display
            });

            totalPairs += workload.secondMarkingCount;
            uniquePairs += pairs.size;
        });

        // Calculate pairing efficiency (lower unique pairs = better)
        statistics.pairingEfficiency = totalPairs > 0 ? (totalPairs / uniquePairs).toFixed(2) : 0;

        console.log('Assignment completed:');
        console.log(`- Total assignments: ${statistics.totalAssignments}`);
        console.log(`- Unique pairs: ${uniquePairs}`);
        console.log(`- Pairing efficiency: ${statistics.pairingEfficiency}`);

        return {
            assignments: results,
            statistics: statistics
        };
    }

}

// Enhanced controller function with validation
const assignSecondMarkers = async (req, res) => {
    try {
        console.log('Starting second marker assignment...');

        const allocations = await Allocation.getAll();
        const supervisors = await User.getAllByRole('supervisor');

        // Filter allocations that have supervisors assigned
        const supervisedAllocations = allocations.filter(a => a.supervisorId);

        if (supervisedAllocations.length === 0) {
            return res.status(400).json({
                message: 'No allocations with supervisors found. Run allocation process first.'
            });
        }

        console.log(`Processing ${supervisedAllocations.length} allocations with ${supervisors.length} supervisors`);

        const assignmentEngine = new SecondMarkerAssignment(supervisedAllocations, supervisors);
        const results = assignmentEngine.assignSecondMarkers();

        // Validate results
        const imbalances = results.statistics.supervisorPairStats.filter(stat => !stat.isBalanced);
        if (imbalances.length > 0) {
            console.warn('Assignment completed with imbalances:', imbalances);
        }

        res.json({
            message: 'Second markers assigned successfully',
            assignments: results.assignments,
            statistics: results.statistics,
            warnings: imbalances.length > 0 ? 'Some supervisors have imbalanced assignments' : null
        });

    } catch (error) {
        console.error('Error assigning second markers:', error);
        res.status(500).json({
            message: 'Error assigning second markers: ' + error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Get second marker assignments with validation
const getSecondMarkerAssignments = async (req, res) => {
    try {
        const allocations = await Allocation.getAll();
        const supervisors = await User.getAllByRole('supervisor');
        const supervisedAllocations = allocations.filter(a => a.supervisorId);

        if (supervisedAllocations.length === 0) {
            return res.json([]);
        }

        const assignmentEngine = new SecondMarkerAssignment(supervisedAllocations, supervisors);
        const results = assignmentEngine.assignSecondMarkers();

        res.json(results.assignments);
    } catch (error) {
        console.error('Error fetching second marker assignments:', error);
        res.status(500).json({
            message: 'Error fetching second marker assignments',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = {
    assignSecondMarkers,
    getSecondMarkerAssignments,
    SecondMarkerAssignment
};