const Allocation = require('../models/Allocation');
const Preference = require('../models/Preference');
const Title = require('../models/Title');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');

const { ObjectId } = require('mongodb');



// Correct Gale-Shapley Algorithm Implementation
class GaleShapleyAllocation {
  constructor(students, titles) {
    this.students = students;
    this.titles = titles;
    this.allocations = new Map(); // titleId -> student
    this.studentMatches = new Map(); // studentId -> titleId
    this.titleCapacity = new Map();

    // Initialize capacity - each title can only be allocated to one student
    titles.forEach(title => {
      this.titleCapacity.set(title._id.toString(), 1);
    });

    // Store student preferences in proper format
    this.studentPreferences = new Map();
    this.titlePreferences = new Map(); // For tracking which students want which titles

    students.forEach(student => {
      // Sort preferences by rank (1 = highest priority)
      const sortedPrefs = student.preferences.sort((a, b) => a.rank - b.rank);
      this.studentPreferences.set(student.studentId.toString(), sortedPrefs);
    });

    // Build title preferences based on student submission time (first come first served)
    this.buildTitlePreferences();
  }



  buildTitlePreferences() {
    // For each title, build a list of students who want it, ordered by submission time
    this.titles.forEach(title => {
      const titleId = title._id.toString();
      const studentsWantingThisTitle = [];

      this.students.forEach(student => {
        const prefs = this.studentPreferences.get(student.studentId.toString());
        const prefForThisTitle = prefs.find(p => p.titleId.toString() === titleId);

        if (prefForThisTitle) {
          studentsWantingThisTitle.push({
            studentId: student.studentId,
            studentName: student.studentName,
            studentUsername: student.studentUsername,
            rank: prefForThisTitle.rank,
            submittedAt: student.submittedAt
          });
        }
      });

      // Sort by: 1) preference rank, 2) submission time (earlier first)
      studentsWantingThisTitle.sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank; // Lower rank (1) is better
        }
        return new Date(a.submittedAt) - new Date(b.submittedAt); // Earlier submission is better
      });

      this.titlePreferences.set(titleId, studentsWantingThisTitle);
    });
  }

  run() {
    let freeStudents = [...this.students];
    const proposals = new Map(); // Track how many proposals each student has made

    // Initialize proposals counter
    this.students.forEach(student => {
      proposals.set(student.studentId.toString(), 0);
    });

    while (freeStudents.length > 0) {
      const student = freeStudents[0];
      const studentId = student.studentId.toString();
      const proposalIndex = proposals.get(studentId);
      const preferences = this.studentPreferences.get(studentId);

      // If student has proposed to all preferences, they remain unmatched
      if (proposalIndex >= preferences.length) {
        freeStudents.shift();
        continue;
      }

      const preferredTitle = preferences[proposalIndex];
      const titleId = preferredTitle.titleId.toString();

      if (!this.allocations.has(titleId)) {
        // Title is free, allocate to student
        this.allocations.set(titleId, student);
        this.studentMatches.set(studentId, titleId);
        freeStudents.shift();
      } else {
        // Title is already allocated, check if this student has higher priority
        const currentStudent = this.allocations.get(titleId);
        const currentStudentId = currentStudent.studentId.toString();

        // Get the preference list for this title
        const titlePrefList = this.titlePreferences.get(titleId);

        // Find positions of current and proposing student in title's preference list
        const currentStudentIndex = titlePrefList.findIndex(s => s.studentId.toString() === currentStudentId);
        const newStudentIndex = titlePrefList.findIndex(s => s.studentId.toString() === studentId);

        // If new student has better position (lower index = higher preference)
        if (newStudentIndex < currentStudentIndex) {
          // Replace current student with new student
          this.allocations.set(titleId, student);
          this.studentMatches.set(studentId, titleId);

          // Remove old match and add old student back to free list
          this.studentMatches.delete(currentStudentId);
          freeStudents.shift(); // Remove new student from free list
          freeStudents.push(currentStudent); // Add old student back to free list

          // Reset proposal counter for the rejected student
          proposals.set(currentStudentId, proposals.get(currentStudentId) + 1);
        } else {
          // Current student keeps the title, move to next preference
          proposals.set(studentId, proposalIndex + 1);
        }
      }
    }

    return this.getAllocations();
  }

  getAllocations() {
    const results = [];

    for (const [titleId, student] of this.allocations) {
      const title = this.titles.find(t => t._id.toString() === titleId);
      if (title) {
        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          studentUsername: student.studentUsername,
          titleId: title._id,
          title: title.title,
          supervisorId: title.supervisorId,
          supervisorName: title.supervisorName,
          isCustomTitle: false,
          preferenceRank: this.getPreferenceRank(student.studentId.toString(), titleId)
        });
      }
    }

    // Handle unmatched students (shouldn't happen with proper preferences)
    const matchedStudentIds = new Set(Array.from(this.studentMatches.keys()));
    this.students.forEach(student => {
      const studentId = student.studentId.toString();
      if (!matchedStudentIds.has(studentId)) {
        console.log(`Student ${student.studentName} was not allocated any title`);
      }
    });

    return results;
  }

  getPreferenceRank(studentId, titleId) {
    const prefs = this.studentPreferences.get(studentId);
    const pref = prefs.find(p => p.titleId.toString() === titleId);
    return pref ? pref.rank : null;
  }
}

// Add method to calculate supervisor remaining capacity
const calculateSupervisorCapacity = (allocations, supervisors) => {
  const capacityMap = new Map();

  supervisors.forEach(supervisor => {
    capacityMap.set(supervisor._id.toString(), {
      capacity: supervisor.capacity || 0,
      current: 0,
      remaining: supervisor.capacity || 0
    });
  });

  allocations.forEach(allocation => {
    const supervisorId = allocation.supervisorId.toString();
    if (capacityMap.has(supervisorId)) {
      capacityMap.get(supervisorId).current++;
      capacityMap.get(supervisorId).remaining--;
    }
  });

  return capacityMap;
};

// Enhanced allocation algorithm with your requirements
class ComprehensiveAllocation {
  constructor(students, titles, supervisorCapacity) {
    this.students = students;
    this.titles = titles;
    this.supervisorCapacity = supervisorCapacity;
    this.allocations = new Map();
    this.studentMatches = new Map();
  }

  // Categorize students into different groups
  categorizeStudents(preferences) {
    const studentsWithPreferences = new Set();
    const studentsWithApprovedCustom = new Set();
    const studentsWithRejectedCustom = new Set();
    const studentsWithPendingCustom = new Set();

    preferences.forEach(pref => {
      studentsWithPreferences.add(pref.studentId.toString());

      if (pref.customTitle) {
        if (pref.customTitle.status === 'approved') {
          studentsWithApprovedCustom.add(pref.studentId.toString());
        } else if (pref.customTitle.status === 'rejected') {
          studentsWithRejectedCustom.add(pref.studentId.toString());
        } else {
          studentsWithPendingCustom.add(pref.studentId.toString());
        }
      }
    });

    // Students without any preferences
    const studentsWithoutPreferences = this.students.filter(student =>
      !studentsWithPreferences.has(student._id.toString())
    );

    return {
      studentsWithApprovedCustom: Array.from(studentsWithApprovedCustom),
      studentsWithRejectedCustom: Array.from(studentsWithRejectedCustom),
      studentsWithPendingCustom: Array.from(studentsWithPendingCustom),
      studentsWithoutPreferences: studentsWithoutPreferences,
      studentsWithRegularPreferences: preferences.filter(pref =>
        !studentsWithApprovedCustom.has(pref.studentId.toString())
      )
    };
  }

  // Allocate students with approved custom titles
  allocateApprovedCustomTitles(preferences) {
    const customTitleAllocations = [];
    const capacityConflicts = [];

    for (const pref of preferences) {
      if (pref.customTitle && pref.customTitle.status === 'approved') {
        const student = this.students.find(s => s._id.toString() === pref.studentId.toString());
        let supervisor;

        if (pref.customTitle.approvedSupervisorId) {
          supervisor = this.supervisors.find(s => s._id.toString() === pref.customTitle.approvedSupervisorId.toString());
        } else {
          supervisor = this.supervisors.find(s =>
            s.username === pref.customTitle.supervisorUsername ||
            s.name === pref.customTitle.supervisorName
          );
        }

        if (supervisor && student) {
          const supervisorId = supervisor._id.toString();

          if (this.supervisorCapacity.has(supervisorId)) {
            const cap = this.supervisorCapacity.get(supervisorId);

            if (cap.current < cap.capacity) {
              // Allocate custom title
              const allocation = {
                studentId: student._id,
                studentName: student.name,
                studentUsername: student.username,
                titleId: new ObjectId(),
                title: pref.customTitle.title + '*',
                supervisorId: supervisor._id,
                supervisorName: supervisor.name,
                isCustomTitle: true,
                isApprovedCustomTitle: true,
                needsSupervisor: false,
                allocatedAt: new Date()
              };

              customTitleAllocations.push(allocation);
              this.allocations.set(`${student._id}-custom`, allocation);
              this.studentMatches.set(student._id.toString(), allocation);

              // Update capacity
              cap.current++;
              cap.remaining--;
            } else {
              // Capacity conflict - supervisor at capacity
              capacityConflicts.push({
                studentId: student._id,
                studentName: student.name,
                studentUsername: student.username,
                customTitle: pref.customTitle.title,
                preferredSupervisorId: supervisor._id,
                preferredSupervisorName: supervisor.name,
                supervisorCapacity: cap.capacity,
                supervisorCurrent: cap.current,
                conflictType: 'CAPACITY_EXCEEDED'
              });
            }
          }
        }
      }
    }

    return { customTitleAllocations, capacityConflicts };
  }

  // Allocate students with regular preferences using Gale-Shapley
  allocateRegularPreferences(studentData) {
    if (studentData.length === 0) return { allocations: [], unmatchedStudents: [] };

    const algorithm = new EnhancedGaleShapleyAllocation(studentData, this.titles, this.supervisorCapacity);
    return algorithm.run();
  }

  // Allocate students without any preferences - NEW IMPLEMENTATION
  allocateStudentsWithoutPreferences(studentsWithoutPrefs) {
    const allocations = [];

    if (studentsWithoutPrefs.length === 0) return allocations;

    // Get supervisors with remaining capacity, sorted by most capacity first
    const availableSupervisors = Array.from(this.supervisorCapacity.entries())
      .map(([supervisorId, cap]) => ({
        supervisorId,
        ...cap,
        supervisor: this.supervisors.find(s => s._id.toString() === supervisorId)
      }))
      .filter(cap => cap.remaining > 0 && cap.supervisor)
      .sort((a, b) => b.remaining - a.remaining);

    if (availableSupervisors.length === 0) {
      console.warn('No supervisors with remaining capacity for students without preferences');
      return allocations;
    }

    // Distribute students evenly to use 100% of supervisor capacity
    let studentIndex = 0;

    while (studentIndex < studentsWithoutPrefs.length && availableSupervisors.length > 0) {
      const student = studentsWithoutPrefs[studentIndex];

      // Find the supervisor with the most remaining capacity
      availableSupervisors.sort((a, b) => b.remaining - a.remaining);
      const supervisor = availableSupervisors[0];

      const allocation = {
        studentId: student._id,
        studentName: student.name,
        studentUsername: student.username,
        titleId: new ObjectId(),
        title: 'To decide with supervisor', // Placeholder title as requested
        supervisorId: supervisor.supervisorId,
        supervisorName: supervisor.supervisor.name,
        isCustomTitle: false,
        needsSupervisor: false,
        isAutoAllocated: true, // Flag to indicate this was auto-allocated
        allocatedAt: new Date(),
        note: 'Automatically allocated - no preferences submitted'
      };

      allocations.push(allocation);
      this.allocations.set(`${student._id}-auto`, allocation);
      this.studentMatches.set(student._id.toString(), allocation);

      // Update supervisor capacity
      supervisor.current++;
      supervisor.remaining--;

      // Update the main capacity map
      const cap = this.supervisorCapacity.get(supervisor.supervisorId);
      cap.current = supervisor.current;
      cap.remaining = supervisor.remaining;

      // If supervisor is now full, remove from available list
      if (supervisor.remaining === 0) {
        availableSupervisors.shift(); // Remove the first element (this supervisor)
      }

      studentIndex++;
    }

    return allocations;
  }

  // Handle unmatched students from regular allocation
  handleUnmatchedStudents(unmatchedStudents) {
    const needsSupervisorAllocations = [];

    for (const student of unmatchedStudents) {
      // Find any supervisor with remaining capacity
      const availableSupervisor = Array.from(this.supervisorCapacity.entries())
        .find(([_, cap]) => cap.remaining > 0);

      let supervisor = null;
      if (availableSupervisor) {
        supervisor = this.supervisors.find(s => s._id.toString() === availableSupervisor[0]);
      }

      const allocation = {
        studentId: student.studentId,
        studentName: student.studentName,
        studentUsername: student.studentUsername,
        titleId: student.preferences && student.preferences.length > 0 ?
          student.preferences[0].titleId : new ObjectId(),
        title: student.preferences && student.preferences.length > 0 ?
          student.preferences[0].title : 'To decide with supervisor',
        supervisorId: supervisor ? supervisor._id : null,
        supervisorName: supervisor ? supervisor.name : null,
        originalSupervisorId: student.preferences && student.preferences.length > 0 ?
          this.titles.find(t => t._id.toString() === student.preferences[0].titleId.toString())?.supervisorId : null,
        originalSupervisorName: student.preferences && student.preferences.length > 0 ?
          this.titles.find(t => t._id.toString() === student.preferences[0].titleId.toString())?.supervisorName : null,
        isCustomTitle: false,
        needsSupervisor: !supervisor, // Only need supervisor if we couldn't find one
        preferenceRank: student.preferences && student.preferences.length > 0 ? student.preferences[0].rank : null,
        isTop3: student.preferences && student.preferences.length > 0 && student.preferences[0].rank <= 3,
        isUnmatched: true
      };

      needsSupervisorAllocations.push(allocation);
      this.allocations.set(`${student.studentId}-needs-supervisor`, allocation);
      this.studentMatches.set(student.studentId.toString(), allocation);

      // If we found a supervisor, update capacity
      if (supervisor) {
        const supervisorId = supervisor._id.toString();
        if (this.supervisorCapacity.has(supervisorId)) {
          const cap = this.supervisorCapacity.get(supervisorId);
          cap.current++;
          cap.remaining--;
        }
      }
    }

    return needsSupervisorAllocations;
  }

  // Main allocation method
  async runAllocation(preferences, supervisors) {
    this.supervisors = supervisors;

    // Categorize students
    const categories = this.categorizeStudents(preferences);

    console.log('Student Categories:', {
      totalStudents: this.students.length,
      withPreferences: preferences.length,
      withApprovedCustom: categories.studentsWithApprovedCustom.length,
      withRejectedCustom: categories.studentsWithRejectedCustom.length,
      withPendingCustom: categories.studentsWithPendingCustom.length,
      withoutPreferences: categories.studentsWithoutPreferences.length
    });

    // 1. Allocate students with approved custom titles
    const { customTitleAllocations, capacityConflicts } = this.allocateApprovedCustomTitles(preferences);

    // 2. Prepare data for students with regular preferences 
    // (including those with rejected/pending custom titles - they use their regular preferences)
    const studentData = await Promise.all(
      categories.studentsWithRegularPreferences.map(async pref => {
        const student = this.students.find(s => s._id.toString() === pref.studentId.toString());
        return {
          studentId: pref.studentId,
          studentName: student?.name || 'Unknown',
          studentUsername: student?.username || 'Unknown',
          preferences: pref.preferences.sort((a, b) => a.rank - b.rank),
          submittedAt: pref.submittedAt,
          customTitle: pref.customTitle,
          hasRejectedCustomTitle: pref.customTitle && pref.customTitle.status === 'rejected',
          hasPendingCustomTitle: pref.customTitle && (!pref.customTitle.status || pref.customTitle.status === 'pending')
        };
      })
    );

    // 3. Allocate students with regular preferences
    const { allocations: regularAllocations, unmatchedStudents } = this.allocateRegularPreferences(studentData);

    // 4. Allocate students without any preferences
    const autoAllocations = this.allocateStudentsWithoutPreferences(categories.studentsWithoutPreferences);

    // 5. Handle unmatched students from regular allocation
    const needsSupervisorAllocations = this.handleUnmatchedStudents(unmatchedStudents);

    // Combine all allocations
    const allAllocations = [
      ...customTitleAllocations,
      ...regularAllocations,
      ...autoAllocations,
      ...needsSupervisorAllocations
    ];

    // Verify all students are allocated and check capacity constraints
    const allocatedStudentIds = new Set(allAllocations.map(a => a.studentId.toString()));
    const unallocatedStudents = this.students.filter(student =>
      !allocatedStudentIds.has(student._id.toString())
    );

    // Check for capacity violations - NEVER allow overcapacity
    const overCapacitySupervisors = Array.from(this.supervisorCapacity.entries())
      .filter(([_, cap]) => cap.current > cap.capacity);

    if (unallocatedStudents.length > 0) {
      console.error(`${unallocatedStudents.length} students could not be allocated:`,
        unallocatedStudents.map(s => s.name));

      // Instead of emergency allocation, notify admin
      capacityConflicts.push({
        conflictType: 'UNALLOCATED_STUDENTS',
        unallocatedStudents: unallocatedStudents.map(s => ({
          studentId: s._id,
          studentName: s.name,
          studentUsername: s.username
        })),
        message: `${unallocatedStudents.length} students could not be allocated due to capacity constraints`
      });
    }

    if (overCapacitySupervisors.length > 0) {
      console.error('Capacity violation detected:', overCapacitySupervisors);

      overCapacitySupervisors.forEach(([supervisorId, cap]) => {
        const supervisor = this.supervisors.find(s => s._id.toString() === supervisorId);
        capacityConflicts.push({
          conflictType: 'OVER_CAPACITY',
          supervisorId: supervisorId,
          supervisorName: supervisor?.name || 'Unknown',
          currentAllocations: cap.current,
          capacity: cap.capacity,
          message: `${supervisor?.name || 'Unknown'} has ${cap.current} students but capacity is ${cap.capacity}`
        });
      });
    }

    return {
      allocations: allAllocations,
      capacityConflicts,
      statistics: this.generateStatistics(allAllocations, categories, capacityConflicts, unallocatedStudents)
    };
  }

  // Generate comprehensive statistics
  generateStatistics(allocations, categories, capacityConflicts, unallocatedStudents) {
    const totalCapacity = Array.from(this.supervisorCapacity.values())
      .reduce((sum, cap) => sum + cap.capacity, 0);

    const totalAllocated = allocations.length;
    const totalStudents = this.students.length;

    const stats = {
      totalStudents: totalStudents,
      totalCapacity: totalCapacity,
      totalAllocated: totalAllocated,
      unallocatedStudents: unallocatedStudents.length,
      studentsWithPreferences: categories.studentsWithRegularPreferences.length +
        categories.studentsWithApprovedCustom.length,
      studentsWithoutPreferences: categories.studentsWithoutPreferences.length,
      studentsWithApprovedCustomTitles: allocations.filter(a => a.isApprovedCustomTitle).length,
      studentsWithRejectedCustomTitles: categories.studentsWithRejectedCustom.length,
      studentsWithPendingCustomTitles: categories.studentsWithPendingCustom.length,
      studentsWithRegularAllocations: allocations.filter(a => !a.isCustomTitle && !a.isAutoAllocated).length,
      studentsAutoAllocated: allocations.filter(a => a.isAutoAllocated).length,
      studentsNeedingSupervisor: allocations.filter(a => a.needsSupervisor).length,
      capacityConflicts: capacityConflicts.length,
      capacityUtilization: totalCapacity > 0 ? ((totalAllocated / totalCapacity) * 100).toFixed(1) + '%' : '0%',
      supervisorUtilization: Array.from(this.supervisorCapacity.values()).map(cap => ({
        supervisorName: cap.supervisorName,
        current: cap.current,
        capacity: cap.capacity,
        remaining: cap.remaining,
        utilization: cap.capacity > 0 ? ((cap.current / cap.capacity) * 100).toFixed(1) + '%' : '0%',
        isOverCapacity: cap.current > cap.capacity
      })),
      allocationBreakdown: {
        byCustomTitle: allocations.filter(a => a.isCustomTitle).length,
        byRegularPreferences: allocations.filter(a => !a.isCustomTitle && !a.isAutoAllocated).length,
        byAutoAllocation: allocations.filter(a => a.isAutoAllocated).length
      }
    };

    return stats;
  }
}

// Enhanced Gale-Shapley with capacity constraints (NO overcapacity allowed)
class EnhancedGaleShapleyAllocation {
  constructor(students, titles, supervisorCapacity) {
    this.students = students;
    this.titles = titles;
    this.supervisorCapacity = supervisorCapacity;
    this.allocations = new Map();
    this.studentMatches = new Map();
    this.titleCapacity = new Map();

    // Initialize capacity - each title can only be allocated to one student
    titles.forEach(title => {
      this.titleCapacity.set(title._id.toString(), 1);
    });

    // Store student preferences
    this.studentPreferences = new Map();
    this.titlePreferences = new Map();

    students.forEach(student => {
      const sortedPrefs = student.preferences.sort((a, b) => a.rank - b.rank);
      this.studentPreferences.set(student.studentId.toString(), sortedPrefs);
    });

    this.buildTitlePreferences();
  }

  buildTitlePreferences() {
    this.titles.forEach(title => {
      const titleId = title._id.toString();
      const studentsWantingThisTitle = [];

      this.students.forEach(student => {
        const prefs = this.studentPreferences.get(student.studentId.toString());
        const prefForThisTitle = prefs.find(p => p.titleId.toString() === titleId);

        if (prefForThisTitle) {
          studentsWantingThisTitle.push({
            studentId: student.studentId,
            studentName: student.studentName,
            studentUsername: student.studentUsername,
            rank: prefForThisTitle.rank,
            submittedAt: student.submittedAt
          });
        }
      });

      // Sort by: 1) preference rank, 2) submission time (earlier first)
      studentsWantingThisTitle.sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });

      this.titlePreferences.set(titleId, studentsWantingThisTitle);
    });
  }

  run() {
    let freeStudents = [...this.students];
    const proposals = new Map();
    const unmatchedStudents = [];

    // Initialize proposals counter
    this.students.forEach(student => {
      proposals.set(student.studentId.toString(), 0);
    });

    while (freeStudents.length > 0) {
      const student = freeStudents[0];
      const studentId = student.studentId.toString();
      const proposalIndex = proposals.get(studentId);
      const preferences = this.studentPreferences.get(studentId);

      // If student has proposed to all preferences, they remain unmatched
      if (proposalIndex >= preferences.length) {
        unmatchedStudents.push(freeStudents.shift());
        continue;
      }

      const preferredTitle = preferences[proposalIndex];
      const titleId = preferredTitle.titleId.toString();
      const title = this.titles.find(t => t._id.toString() === titleId);

      if (!title) {
        proposals.set(studentId, proposalIndex + 1);
        continue;
      }

      const supervisorId = title.supervisorId ? title.supervisorId.toString() : null;

      // Check if supervisor exists and has capacity (STRICT - no overcapacity)
      if (supervisorId && this.supervisorCapacity.has(supervisorId)) {
        const supervisorCap = this.supervisorCapacity.get(supervisorId);

        // Only allocate if supervisor has STRICT capacity
        if (!this.allocations.has(titleId) && supervisorCap.remaining > 0) {
          // Title is free and supervisor has capacity
          this.allocations.set(titleId, student);
          this.studentMatches.set(studentId, titleId);
          supervisorCap.current++;
          supervisorCap.remaining--;
          freeStudents.shift();
        } else {
          // Title is allocated or supervisor has no capacity
          proposals.set(studentId, proposalIndex + 1);
        }
      } else {
        // Supervisor doesn't exist or title has no supervisor assigned
        proposals.set(studentId, proposalIndex + 1);
      }
    }

    return {
      allocations: this.getAllocations(),
      unmatchedStudents: unmatchedStudents
    };
  }

  getAllocations() {
    const results = [];

    for (const [titleId, student] of this.allocations) {
      const title = this.titles.find(t => t._id.toString() === titleId);
      if (title) {
        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          studentUsername: student.studentUsername,
          titleId: title._id,
          title: title.title,
          supervisorId: title.supervisorId,
          supervisorName: title.supervisorName,
          isCustomTitle: false,
          preferenceRank: this.getPreferenceRank(student.studentId.toString(), titleId)
        });
      }
    }

    return results;
  }

  getPreferenceRank(studentId, titleId) {
    const prefs = this.studentPreferences.get(studentId);
    const pref = prefs.find(p => p.titleId.toString() === titleId);
    return pref ? pref.rank : null;
  }
}

// Update the main runAllocation function
const runAllocation = async (req, res) => {
  try {
    // Clear previous allocations
    await Allocation.deleteAll();

    // Get all data
    const preferences = await Preference.getAll();
    const approvedTitles = await Title.getAllApproved();
    const students = await User.getAllByRole('student');
    const supervisors = await User.getAllByRole('supervisor');

    if (approvedTitles.length === 0) {
      return res.status(400).json({ message: 'No approved titles found' });
    }

    if (students.length === 0) {
      return res.status(400).json({ message: 'No students found' });
    }

    // Calculate total capacity and verify it matches student count
    const totalCapacity = supervisors.reduce((sum, supervisor) =>
      sum + (supervisor.capacity || 0), 0
    );

    if (totalCapacity !== students.length) {
      return res.status(400).json({
        message: `Capacity mismatch: Total supervisor capacity (${totalCapacity}) does not match number of students (${students.length}). Please adjust supervisor capacities.`
      });
    }

    // Create supervisor capacity map
    const supervisorCapacity = new Map();
    supervisors.forEach(supervisor => {
      if (supervisor && supervisor._id) {
        supervisorCapacity.set(supervisor._id.toString(), {
          capacity: supervisor.capacity || 0,
          current: 0,
          remaining: supervisor.capacity || 0,
          supervisorName: supervisor.name
        });
      }
    });

    console.log(`Initialized capacity for ${supervisorCapacity.size} supervisors`);
    console.log(`Total students: ${students.length}, Total capacity: ${totalCapacity}`);

    // Run comprehensive allocation
    const algorithm = new ComprehensiveAllocation(students, approvedTitles, supervisorCapacity);
    const result = await algorithm.runAllocation(preferences, supervisors);

    // Save allocations to database
    for (const allocation of result.allocations) {
      await Allocation.create(allocation);
    }

    // Generate response message
    let message = 'Allocation completed! ';
    const messages = [];

    if (result.allocations.length === students.length) {
      messages.push(`All ${students.length} students have been allocated.`);
    } else {
      messages.push(`${result.allocations.length} out of ${students.length} students allocated.`);
    }

    if (result.statistics.studentsAutoAllocated > 0) {
      messages.push(`${result.statistics.studentsAutoAllocated} students without preferences were automatically allocated with "To decide with supervisor" titles.`);
    }

    if (result.statistics.studentsNeedingSupervisor > 0) {
      messages.push(`${result.statistics.studentsNeedingSupervisor} students need supervisor assignment.`);
    }

    if (result.capacityConflicts.length > 0) {
      messages.push(`${result.capacityConflicts.length} issues require admin attention.`);
    }

    message += messages.join(' ');

    res.json({
      message: message,
      allocations: result.allocations.length,
      capacityConflicts: result.capacityConflicts,
      statistics: result.statistics,
      success: result.capacityConflicts.length === 0 && result.allocations.length === students.length
    });

    // Set allocation as completed only if fully successful
    if (result.capacityConflicts.length === 0 && result.allocations.length === students.length) {
      await SystemSettings.setAllocationCompleted(true);
      await SystemSettings.setAllocationPublished(false);
    }

  } catch (error) {
    console.error('Allocation error:', error);
    res.status(500).json({ message: 'Allocation failed: ' + error.message });
  }
};

const adminBatchUpdateSupervisors = async (req, res) => {
  try {
    const { changes } = req.body;
    if (!changes || !Array.isArray(changes)) return res.status(400).json({ message: 'Invalid changes' });

    const settings = await SystemSettings.getSettings();
    if (settings.allocationPublished) {
      return res.status(400).json({ message: 'Cannot edit after publishing. Unpublish first.' });
    }

    const supervisors = await User.getAllByRole('supervisor');
    const allocations = await Allocation.getAll();

    // Build capacity map
    const capacityMap = new Map();
    supervisors.forEach(s => capacityMap.set(s._id.toString(), { capacity: s.capacity || 0, current: 0 }));

    allocations.forEach(a => {
      if (a.supervisorId && capacityMap.has(a.supervisorId.toString())) {
        capacityMap.get(a.supervisorId.toString()).current++;
      }
    });

    // Simulate changes
    for (const { allocationId, newSupervisorId } of changes) {
      const alloc = allocations.find(a => a._id.toString() === allocationId);
      if (!alloc) continue;
      if (alloc.supervisorId && capacityMap.has(alloc.supervisorId.toString())) {
        capacityMap.get(alloc.supervisorId.toString()).current--;
      }
      if (capacityMap.has(newSupervisorId)) {
        capacityMap.get(newSupervisorId).current++;
      }
    }

    // Check capacity
    const overCapacity = [...capacityMap.entries()].filter(([_, v]) => v.current > v.capacity);
    if (overCapacity.length > 0) {
      return res.status(400).json({ message: 'Capacity exceeded for some supervisors', errors: overCapacity.map(([id, v]) => `${id}: ${v.current}/${v.capacity}`) });
    }

    // Apply changes
    for (const { allocationId, newSupervisorId } of changes) {
      const sup = supervisors.find(s => s._id.toString() === newSupervisorId);
      await Allocation.updateSupervisor(allocationId, sup._id, sup.name);
    }

    res.json({ message: 'Changes saved successfully', updatedCount: changes.length });
  } catch (err) {
    res.status(500).json({ message: 'Error saving changes: ' + err.message });
  }
};

const publishAllocations = async (req, res) => {
  try {
    await SystemSettings.setAllocationPublished(true);

    res.json({
      message: 'Allocations published successfully! Students and supervisors can now view their allocations.',
      publishedAt: new Date()
    });
  } catch (error) {
    console.error('Error publishing allocations:', error);
    res.status(500).json({ message: 'Error publishing allocations: ' + error.message });
  }
};

const unpublishAllocations = async (req, res) => {
  try {
    await SystemSettings.setAllocationPublished(false);

    res.json({
      message: 'Allocations unpublished successfully! Students and supervisors can no longer view allocations.',
      unpublishedAt: new Date()
    });
  } catch (error) {
    console.error('Error unpublishing allocations:', error);
    res.status(500).json({ message: 'Error unpublishing allocations: ' + error.message });
  }
};


// Helper function to calculate preference statistics
function calculatePreferenceStats(allocations) {
  const stats = { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0 };

  allocations.forEach(allocation => {
    if (allocation.preferenceRank === 1) stats.rank1++;
    else if (allocation.preferenceRank === 2) stats.rank2++;
    else if (allocation.preferenceRank === 3) stats.rank3++;
    else if (allocation.preferenceRank === 4) stats.rank4++;
    else if (allocation.preferenceRank === 5) stats.rank5++;
  });

  return stats;
}

const getAllocations = async (req, res) => {
  try {

    const settings = await SystemSettings.getSettings();

    // If allocations aren't published, only admin can see them
    if (!settings.allocationPublished && req.user.role !== 'admin') {
      return res.json([]); // Return empty array for non-admins
    }

    let allocations;

    if (req.user.role === 'student') {
      allocations = await Allocation.findByStudent(req.user._id);
    } else if (req.user.role === 'supervisor') {
      allocations = await Allocation.findBySupervisor(req.user._id);
    } else {
      allocations = await Allocation.getAll();
    }

    res.json(allocations || []);
  } catch (error) {
    console.error('Get allocations error:', error);
    res.status(500).json({ message: 'Failed to get allocations' });
  }
};

// Add allocation statistics endpoint
const getAllocationStats = async (req, res) => {
  try {
    const allocations = await Allocation.getAll();
    const preferences = await Preference.getAll();

    const stats = {
      totalStudents: preferences.length,
      allocatedStudents: allocations.length,
      unallocatedStudents: preferences.length - allocations.length,
      customTitles: allocations.filter(a => a.isCustomTitle).length
    };

    res.json(stats);
  } catch (error) {
    console.error('Get allocation stats error:', error);
    res.status(500).json({ message: 'Failed to get allocation statistics' });
  }
};

module.exports = {
  runAllocation,
  getAllocations,
  getAllocationStats,
  adminBatchUpdateSupervisors,
  publishAllocations,
  unpublishAllocations,
  ComprehensiveAllocation,
};