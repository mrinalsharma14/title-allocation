const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Title = require('../models/Title');

const router = express.Router();

// Get titles based on user role
router.get('/', auth, async (req, res) => {
  try {
    let titles;
    if (req.user.role === 'supervisor') {
      titles = await Title.findBySupervisor(req.user._id);
    } else if (req.user.role === 'student') {
      titles = await Title.getAllApproved();
    } else {
      titles = await Title.getAll();
    }
    res.json(titles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching titles' });
  }
});

// Create title (Supervisor and Admin)
router.post('/', auth, authorize('supervisor', 'admin', 'moduleAdmin'), async (req, res) => {
  try {
    const { title, description } = req.body;

    const titleData = {
      title,
      description,
      supervisorId: req.user._id,
      supervisorName: req.user.name
    };

    const newTitle = await Title.create(titleData);
    res.status(201).json(newTitle);
  } catch (error) {
    res.status(400).json({ message: 'Error creating title' });
  }
});

// Update title status (Admin only)
router.patch('/:id/status', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await Title.updateStatus(id, status);
    res.json({ message: `Title ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error updating title status' });
  }
});

// Update title (Admin only)
router.put('/:id', auth, authorize('supervisor', 'admin', 'moduleAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // Check if title exists
    const existingTitle = await Title.findById(id);
    if (!existingTitle) {
      return res.status(404).json({ message: 'Title not found' });
    }

    // If user is supervisor, check if they own the title
    if (req.user.role === 'supervisor' && existingTitle.supervisorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own titles' });
    }

    await Title.update(id, { title, description });

    // Return the updated title
    const updatedTitle = await Title.findById(id);
    res.json({
      message: 'Title updated successfully',
      title: updatedTitle
    });
  } catch (error) {
    console.error('Error updating title:', error);
    res.status(500).json({ message: 'Error updating title' });
  }
});

// Delete title (Admin & Supervisor only)
router.delete('/:id', auth, authorize('supervisor', 'admin', 'moduleAdmin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if title exists and belongs to supervisor (if user is supervisor)
    const title = await Title.findById(id);
    if (!title) {
      return res.status(404).json({ message: 'Title not found' });
    }

    // If user is supervisor (not admin), check if they own this title
    if (req.user.role === 'supervisor' && title.supervisorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own titles' });
    }

    await Title.delete(id);
    res.json({ message: 'Title deleted successfully' });
  } catch (error) {
    console.error('Error deleting title:', error);
    res.status(500).json({ message: 'Error deleting title' });
  }
});

module.exports = router;