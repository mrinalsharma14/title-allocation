const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const SystemSettings = require('../models/SystemSettings');

const router = express.Router();

// Get system settings
router.get('/', auth, async (req, res) => {
    try {
        const settings = await SystemSettings.getSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching system settings:', error);
        res.status(500).json({ message: 'Error fetching system settings' });
    }
});

// Update preference deadline (Admin only)
router.post('/preference-deadline', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const { deadline } = req.body;
        await SystemSettings.updatePreferenceDeadline(deadline);
        res.json({ message: 'Preference deadline updated successfully' });
    } catch (error) {
        console.error('Error updating preference deadline:', error);
        res.status(500).json({ message: 'Error updating preference deadline' });
    }
});

// Set allocation completed status (Admin only)
router.post('/allocation-completed', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const { completed } = req.body;
        await SystemSettings.setAllocationCompleted(completed);
        res.json({ message: `Allocation status set to ${completed ? 'completed' : 'not completed'}` });
    } catch (error) {
        console.error('Error updating allocation status:', error);
        res.status(500).json({ message: 'Error updating allocation status' });
    }
});

// Check if student can edit preferences
router.get('/can-edit-preferences', auth, async (req, res) => {
    try {
        const canEdit = await SystemSettings.isBeforeDeadline();
        const allocationCompleted = await SystemSettings.isAllocationCompleted();

        res.json({
            canEdit,
            allocationCompleted,
            message: canEdit ?
                'You can edit your preferences' :
                'The deadline for editing preferences has passed'
        });
    } catch (error) {
        console.error('Error checking edit permissions:', error);
        res.status(500).json({ message: 'Error checking permissions' });
    }
});

// Update title submission deadline (Admin only)
router.post('/title-submission-deadline', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const { deadline } = req.body;
        await SystemSettings.updateTitleSubmissionDeadline(deadline);
        res.json({ message: 'Title submission deadline updated successfully' });
    } catch (error) {
        console.error('Error updating title submission deadline:', error);
        res.status(500).json({ message: 'Error updating title submission deadline' });
    }
});

// Check if supervisor can edit titles
router.get('/can-edit-titles', auth, authorize('supervisor'), async (req, res) => {
    try {
        const canEdit = await SystemSettings.isBeforeTitleSubmissionDeadline();

        res.json({
            canEdit,
            message: canEdit ?
                'You can edit your titles' :
                'The deadline for editing titles has passed'
        });
    } catch (error) {
        console.error('Error checking edit permissions:', error);
        res.status(500).json({ message: 'Error checking permissions' });
    }
});

router.get('/allocation-status', auth, async (req, res) => {
    try {
        const settings = await SystemSettings.getSettings();
        res.json({
            allocationCompleted: settings.allocationCompleted || false,
            allocationPublished: settings.allocationPublished || false,
            publishedAt: settings.publishedAt || null
        });
    } catch (error) {
        console.error('Error fetching allocation status:', error);
        res.status(500).json({ message: 'Error fetching allocation status' });
    }
});

module.exports = router;