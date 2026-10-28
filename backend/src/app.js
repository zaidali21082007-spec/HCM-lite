const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'HCM Lite API', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api', apiRouter);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
