const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Preference = require('../models/Preference');
const User = require('../models/User');
const Title = require('../models/Title'); // Add this missing import
const SystemSettings = require('../models/SystemSettings');


const router = express.Router();

// Get student's own preferences
router.get('/', auth, authorize('student'), async (req, res) => {
    try {
        const preference = await Preference.findByStudent(req.user._id);
        res.json(preference);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching preferences' });
    }
});

// Create or update preferences (Student)
router.post('/', auth, authorize('student'), async (req, res) => {
    try {
        const { preferences, customTitle } = req.body;

        // Check if deadline has passed
        const canEdit = await SystemSettings.isBeforeDeadline();
        if (!canEdit) {
            return res.status(400).json({
                message: 'The deadline for submitting preferences has passed. You can no longer edit your preferences.'
            });
        }

        // Validate exactly 5 preferences
        if (!preferences || preferences.length !== 5) {
            return res.status(400).json({ message: 'Exactly 5 preferences are required' });
        }

        // Check if student already has preferences
        const existingPreference = await Preference.findByStudent(req.user._id);

        const preferenceData = {
            studentId: req.user._id,
            preferences: preferences,
            customTitle: customTitle
        };

        if (existingPreference) {
            await Preference.update(req.user._id, preferenceData);
            res.json({ message: 'Preferences updated successfully' });
        } else {
            await Preference.create(preferenceData);
            res.status(201).json({ message: 'Preferences submitted successfully' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Error submitting preferences' });
    }
});

// Get all preferences (Admin only)
router.get('/all', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const preferences = await Preference.getAll();
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all preferences' });
    }
});

// Get custom titles (Admin only)
router.get('/custom-titles', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const preferences = await Preference.getAll();
        const students = await User.getAllByRole('student');

        const customTitles = preferences
            .filter(pref => pref.customTitle && pref.customTitle.title)
            .map(pref => {
                const student = students.find(s => s._id.toString() === pref.studentId.toString());
                return {
                    studentId: pref.studentId,
                    studentName: student ? student.name : 'Unknown',
                    studentUsername: student ? student.username : 'Unknown',
                    customTitle: pref.customTitle.title,
                    preferredSupervisor: pref.customTitle.supervisorName,
                    submittedAt: pref.submittedAt
                };
            });

        res.json(customTitles);
    } catch (error) {
        console.error('Error fetching custom titles:', error);
        res.status(500).json({ message: 'Error fetching custom titles' });
    }
});

// Get all student choices with preferences and custom titles (Admin only)
router.get('/student-choices', auth, authorize('admin', 'moduleAdmin'), async (req, res) => {
    try {
        const preferences = await Preference.getAll();
        const students = await User.getAllByRole('student');
        const titles = await Title.getAll(); // This was causing the error

        const studentChoices = await Promise.all(preferences.map(async pref => {
            const student = students.find(s => s._id.toString() === pref.studentId.toString());

            // Get detailed information for each preference
            const detailedPreferences = await Promise.all(
                pref.preferences.map(async p => {
                    const title = titles.find(t => t._id.toString() === p.titleId.toString());
                    return {
                        titleId: p.titleId,
                        title: p.title,
                        supervisorName: p.supervisorName,
                        rank: p.rank,
                        titleStatus: title ? title.status : 'unknown',
                        isAvailable: title ? title.status === 'approved' : false
                    };
                })
            );

            // Sort preferences by rank
            detailedPreferences.sort((a, b) => a.rank - b.rank);

            return {
                studentId: pref.studentId,
                studentName: student ? student.name : 'Unknown',
                studentUsername: student ? student.username : 'Unknown',
                preferences: detailedPreferences,
                customTitle: pref.customTitle ? {
                    title: pref.customTitle.title,
                    supervisorName: pref.customTitle.supervisorName,
                    status: pref.customTitle.status || 'pending',
                    approvedSupervisorId: pref.customTitle.approvedSupervisorId,
                    rejectedReason: pref.customTitle.rejectedReason,
                    submittedAt: pref.submittedAt
                } : null,
                submittedAt: pref.submittedAt,
                updatedAt: pref.updatedAt
            };
        }));

        // Sort by student name
        studentChoices.sort((a, b) => a.studentName.localeCompare(b.studentName));

        res.json(studentChoices);
    } catch (error) {
        console.error('Error fetching student choices:', error);
        res.status(500).json({ message: 'Error fetching student choices' });
    }
});

module.exports = router;