const express = require('express');
const { auth, authorize, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');

const { ObjectId } = require('mongodb');
const csv = require('csv-parser');
const multer = require('multer');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Get all users (Admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const users = await User.collection().find().toArray();
    // Remove passwords from response
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    res.json(safeUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Create single user (Admin only)
// Update the user creation route to restrict admin creation
router.post('/', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
  try {
    const { username, password, role, name, email, capacity } = req.body;

    // Module Admin cannot create admin users
    if (req.user.role === 'moduleAdmin' && (role === 'admin' || role === 'moduleAdmin')) {
      return res.status(403).json({
        message: 'Module Admin cannot create admin or module admin users'
      });
    }

    // Check if user already exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const user = await User.create({
      username,
      password,
      role,
      name,
      email,
      capacity: role === 'supervisor' ? parseInt(capacity) || 0 : 0
    });

    // Return user without password
    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error) {
    res.status(400).json({ message: 'Error creating user: ' + error.message });
  }
});

// Update supervisor capacity (Admin only)
router.put('/:id/capacity', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { capacity } = req.body;

    // Validate capacity
    const capacityNum = parseInt(capacity);
    if (isNaN(capacityNum) || capacityNum < 0) {
      return res.status(400).json({ message: 'Invalid capacity value' });
    }

    // Check if user exists and is a supervisor
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'supervisor') {
      return res.status(400).json({ message: 'Can only set capacity for supervisors' });
    }

    // Update capacity
    await User.collection().updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          capacity: capacityNum,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      message: 'Supervisor capacity updated successfully',
      capacity: capacityNum
    });
  } catch (error) {
    console.error('Error updating capacity:', error);
    res.status(500).json({ message: 'Error updating supervisor capacity' });
  }
});

// Delete user (Admin only)
router.delete('/:id', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Module Admin cannot delete admin users
    if (req.user.role === 'moduleAdmin' &&
      (user.role === 'admin' || user.role === 'moduleAdmin')) {
      return res.status(403).json({
        message: 'Module Admin cannot delete admin or module admin users'
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Prevent deleting the main System Administrator (username 'admin')
    if (user.username === 'admin') {
      return res.status(400).json({ message: 'Cannot delete the System Administrator account' });
    }

    await User.collection().deleteOne({ _id: new ObjectId(id) });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Get all supervisors (Available for students and admin)
router.get('/supervisors', auth, async (req, res) => {
  try {
    const supervisors = await User.getAllByRole('supervisor');
    // Remove passwords from response
    const safeSupervisors = supervisors.map(supervisor => {
      const { password, ...safeSupervisor } = supervisor;
      return safeSupervisor;
    });
    res.json(safeSupervisors);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching supervisors' });
  }
});

// optional server-side template
router.get('/template', auth, authorize('admin'), (req, res) => {
  try {
    const csvContent = `username,password,role,name,email,capacity
student1,password123,student,Student One,student1@live.mdx.ac.uk,
student2,password123,student,Student Two,student2@live.mdx.ac.uk,
supervisor1,password123,supervisor,Dr. Supervisor One,supervisor1@mdx.ac.mu,5
supervisor2,password123,supervisor,Prof. Supervisor Two,supervisor2@mdx.ac.mu,3
admin2,password123,admin,Admin User,admin2@mdx.ac.mu,

# Instructions:
# - Required columns: username, password, role, name, email, capacity
# - Role must be one of: student, supervisor, moduleAdmin
# - Capacity: Only required for supervisors (number of students they can supervise)
# - Email: Use university email format
# - Remove instruction lines (starting with #) before uploading
# - Save as CSV (Comma delimited) format`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users_template.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ message: 'Error generating template' });
  }
});

// Bulk upload users from CSV (Admin only)
// Update CSV upload to validate capacity
router.post('/bulk-upload', auth, authorize('admin', 'moduleAdmin'), upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    filePath = req.file.path;
    const results = [];
    const currentUserRole = req.user.role;
    const errors = [];
    const createdUsers = [];

    // Read and parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase(),
          mapValues: ({ value }) => value.trim()
        }))
        .on('data', (data) => {
          // Skip empty rows and comment lines
          if (data.username && !data.username.startsWith('#')) {
            results.push(data);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'No valid user data found in CSV file' });
    }

    // Validation counters
    let totalStudentCount = 0;
    let totalSupervisorCapacity = 0;
    let supervisorCount = 0; // FIX: Initialize supervisorCount


    // First pass: Validate all data
    for (const [index, row] of results.entries()) {
      const rowNumber = index + 2; // +2 because of header row and 0-based index

      // Required field validation
      if (!row.username) {
        errors.push(`Row ${rowNumber}: Username is required`);
        continue;
      }
      if (!row.password) {
        errors.push(`Row ${rowNumber}: Password is required`);
        continue;
      }
      if (!row.role) {
        errors.push(`Row ${rowNumber}: Role is required`);
        continue;
      }
      if (!row.name) {
        errors.push(`Row ${rowNumber}: Name is required`);
        continue;
      }

      // Role validation - FIX: Define roleStr instead of userRole
      const validRoles = ['student', 'supervisor', 'admin', 'moduleAdmin'];
      const roleStr = row.role.toLowerCase(); // FIX: Changed from userRole to roleStr

      if (!validRoles.includes(roleStr)) {
        errors.push(`Row ${rowNumber}: Invalid role '${row.role}'. Must be one of: ${validRoles.join(', ')}`);
        continue;
      }

      // Module Admin restrictions - FIX: Use roleStr instead of userRole
      if (currentUserRole === 'moduleAdmin' &&
        (roleStr === 'admin' || roleStr === 'moduleAdmin')) {
        errors.push(`Row ${rowNumber}: Module Admin cannot create admin or module admin users`);
        continue;
      }

      // Email validation (if provided)
      if (row.email && !User.isValidEmail(row.email)) {
        errors.push(`Row ${rowNumber}: Invalid email format '${row.email}'`);
        continue;
      }

      // Capacity validation for supervisors
      if (roleStr === 'supervisor') {
        const capacity = parseInt(row.capacity);
        if (isNaN(capacity) || capacity < 0 || capacity > 50) {
          errors.push(`Row ${rowNumber}: Supervisor capacity must be a number between 0 and 50`);
          continue;
        }
        totalSupervisorCapacity += capacity;
        supervisorCount++; // FIX: Increment supervisor count
      } else if (roleStr === 'student') {
        totalStudentCount++;
      }

      // Check for duplicate usernames in CSV
      const duplicateInCSV = results.slice(0, index).some((r, i) =>
        r.username.toLowerCase() === row.username.toLowerCase()
      );
      if (duplicateInCSV) {
        errors.push(`Row ${rowNumber}: Duplicate username '${row.username}' in CSV file`);
        continue;
      }
    }

    // Return validation errors if any
    if (errors.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        message: 'Validation errors found in CSV file',
        errors: errors.slice(0, 10) // Return first 10 errors to avoid overwhelming response
      });
    }

    // Validate capacity constraint - capacity must be AT LEAST student count
    if (totalSupervisorCapacity < totalStudentCount) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        message: `Capacity validation failed: Total supervisor capacity (${totalSupervisorCapacity}) is less than total student count (${totalStudentCount}). Please increase supervisor capacities.`,
        totalStudentCount,
        totalSupervisorCapacity,
        supervisorCount,
        requiredAdditionalCapacity: totalStudentCount - totalSupervisorCapacity
      });
    }

    // Second pass: Create users
    for (const row of results) {
      try {
        // Check if user already exists in database
        const existingUser = await User.findByUsername(row.username);
        if (existingUser) {
          errors.push(`Username '${row.username}' already exists in database`);
          continue;
        }

        const userData = {
          username: row.username,
          password: row.password,
          role: row.role.toLowerCase(),
          name: row.name,
          email: row.email || '',
          capacity: row.role.toLowerCase() === 'supervisor' ? parseInt(row.capacity) : 0
        };

        const user = await User.create(userData);
        createdUsers.push({
          username: user.username,
          role: user.role,
          name: user.name,
          email: user.email,
          capacity: user.capacity
        });

      } catch (error) {
        errors.push(`Error creating user '${row.username}': ${error.message}`);
      }
    }

    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Prepare response
    // const response = {
    //   message: `Bulk upload completed: ${createdUsers.length} users created successfully`,
    //   createdCount: createdUsers.length,
    //   totalStudentCount,
    //   totalSupervisorCapacity,
    //   createdUsers,
    //   warnings: errors.length > 0 ? errors : undefined
    // };

    // if (createdUsers.length === 0) {
    //   return res.status(400).json({
    //     message: 'No users were created due to errors',
    //     errors
    //   });
    // }

    // res.json(response);
    // Prepare response
    const response = {
      success: true,
      message: `Bulk upload completed: ${createdUsers.length} users created successfully`,
      createdCount: createdUsers.length,
      totalStudentCount,
      totalSupervisorCapacity,
      supervisorCount,
      capacityUtilization: totalSupervisorCapacity > 0 ?
        `${Math.round((totalStudentCount / totalSupervisorCapacity) * 100)}%` : '0%',
      createdUsers: createdUsers,
      warnings: errors.length > 0 ? errors : []
    };

    if (createdUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users were created due to errors',
        errors: errors
      });
    }

    // Return successful response
    res.json(response);

  } catch (error) {
    // Clean up uploaded file on error
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.error('Bulk upload error:', error);
    res.status(500).json({
      message: 'Error processing bulk upload: ' + error.message
    });
  }
});

// Create single user (Admin only)
router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { username, password, role, name, email } = req.body;
    const user = await User.create({ username, password, role, name, email });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: 'Error creating user' });
  }
});

module.exports = router;