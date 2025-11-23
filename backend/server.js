const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const titleRoutes = require('./routes/titleRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const customTitleRoutes = require('./routes/customTitleRoutes');
const supervisorAssignmentRoutes = require('./routes/supervisorAssignmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const systemSettingsRoutes = require('./routes/systemSettingsRoutes');
const capacityConflictRoutes = require('./routes/capacityConflictRoutes');
const secondMarkerRoutes = require('./routes/secondMarkerRoutes');


const { connectDB } = require('./config/database');


const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://code.jquery.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"]
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Disable X-Powered-By header
app.disable('x-powered-by');

// Rate Limiting
// ON LOGIN PAGE
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth/login', loginLimiter);


// GLOBAL
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS Configuration for Production
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/titles', titleRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/custom-titles', customTitleRoutes);
app.use('/api/supervisor-assignment', supervisorAssignmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/capacity-conflicts', capacityConflictRoutes);
app.use('/api/second-markers', secondMarkerRoutes);


// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong!'
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Database connection and server start
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});