// backend/server.js
// Main entry point for ChatFlow backend & Socket.IO server
'use strict';

require('dotenv').config();

const http    = require('http');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const { testConnection } = require('./config/db');
const { socketHandler }  = require('./sockets/socketHandler');
const { errorHandler }   = require('./middleware/errorHandler');

// Route imports
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const chatRoutes         = require('./routes/chats');
const messageRoutes      = require('./routes/messages');
const groupRoutes        = require('./routes/groups');
const mediaRoutes        = require('./routes/media');
const notificationRoutes = require('./routes/notifications');
const callRoutes         = require('./routes/calls');
const statusRoutes       = require('./routes/statuses');
const channelRoutes      = require('./routes/channels');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

// ─── Socket.IO Configuration ──────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  maxHttpBufferSize: 1e8, // 100MB max buffer for binary chunks if needed
});

// Attach socket instance to app
app.set('io', io);
app.set('trust proxy', 1);

// Attach socket event listeners
socketHandler(io);

// ─── Middleware ───────────────────────────────────────────────────────────────
// Security headers (configure CSP to allow inline scripts/styles and media for the frontend)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Cross-origin access
app.use(cors({ origin: '*' }));

// Request logger in dev
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// General Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Stricter Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many authentication attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Static Assets ────────────────────────────────────────────────────────────
// Uploaded files directory
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/channels', channelRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ChatFlow API', timestamp: new Date() });
});

// Explicit 404 handler for all /api endpoints to guarantee JSON response
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API endpoint ${req.originalUrl} not found` });
});

// Frontend static files
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// Fallback to frontend index for SPA-friendly paths
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
  await testConnection();

  server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀  ChatFlow server running on port ${PORT}`);
    console.log(`🌐  Frontend URL: http://localhost:${PORT}`);
    console.log(`📡  Socket.IO initialized and ready`);
    console.log(`=========================================`);
  });
}

startServer();

module.exports = { app, server, io };
