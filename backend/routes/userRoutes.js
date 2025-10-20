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
# - Role must be one of: student, supervisor, admin
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
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const results = [];
    const currentUserRole = req.user.role;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const users = [];
          let totalStudentCount = 0;
          let totalSupervisorCapacity = 0;

          // First pass: count students and supervisor capacity
          for (const row of results) {
            if (row.role === 'student') totalStudentCount++;
            if (row.role === 'supervisor') {
              const capacity = parseInt(row.capacity) || 0;
              totalSupervisorCapacity += capacity;
            }
            // Module Admin cannot create admin users
            if (currentUserRole === 'moduleAdmin' &&
              (row.role === 'admin' || row.role === 'moduleAdmin')) {
              fs.unlinkSync(req.file.path);
              return res.status(403).json({
                message: 'Module Admin cannot create admin or module admin users'
              });
            }
          }


          // Validate capacity constraint
          if (totalSupervisorCapacity !== totalStudentCount) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
              message: `Capacity validation failed: Supervisor capacity (${totalSupervisorCapacity}) does not match student count (${totalStudentCount}). Please adjust capacities.`
            });
          }

          // Second pass: create users
          for (const row of results) {
            const password = row.password || 'default123';
            const user = await User.create({
              username: row.username,
              password: password,
              role: row.role,
              name: row.name,
              email: row.email,
              capacity: row.capacity ? parseInt(row.capacity) : 0 // Add capacity
            });
            users.push(user);
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({
            message: 'Users created successfully',
            count: users.length,
            totalStudentCount,
            totalSupervisorCapacity,
            users: users.map(u => ({
              username: u.username,
              role: u.role,
              name: u.name,
              capacity: u.capacity
            }))
          });
        } catch (error) {
          fs.unlinkSync(req.file.path);
          res.status(400).json({ message: 'Error processing CSV: ' + error.message });
        }
      });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Error uploading file' });
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