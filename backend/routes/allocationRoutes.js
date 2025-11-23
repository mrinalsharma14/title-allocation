const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { runAllocation, getAllocations, getAllocationStats, adminBatchUpdateSupervisors, publishAllocations, unpublishAllocations } = require('../controllers/allocationController');

const router = express.Router();

router.post('/run', auth, authorize('admin', 'moduleAdmin'), runAllocation);
router.get('/', auth, getAllocations);
router.get('/stats', auth, authorize('admin', 'moduleAdmin'), getAllocationStats);
router.post('/admin/batch-update-supervisors', auth, authorize('admin', 'moduleAdmin'), adminBatchUpdateSupervisors);
router.post('/publish', auth, authorize('admin', 'moduleAdmin'), publishAllocations);
router.post('/unpublish', auth, authorize('admin', 'moduleAdmin'), unpublishAllocations);

module.exports = router;