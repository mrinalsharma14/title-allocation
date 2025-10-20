const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { runAllocation, getAllocations, getAllocationStats, publishAllocations, unpublishAllocations } = require('../controllers/allocationController');

const router = express.Router();

router.post('/run', auth, authorize('admin', 'moduleAdmin'), runAllocation);
router.get('/', auth, getAllocations);
router.get('/stats', auth, authorize('admin', 'moduleAdmin'), getAllocationStats);
router.post('/publish', auth, authorize('admin', 'moduleAdmin'), publishAllocations);
router.post('/unpublish', auth, authorize('admin', 'moduleAdmin'), unpublishAllocations);

module.exports = router;