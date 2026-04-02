const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./auth');
const taskRoutes = require('./tasks');
const userRoutes = require('./users');

const app = express();

// TODO: add rate limiting middleware
// TODO: implement request logging

app.use(cors());
// Core body parsers only; rate limit and audit hooks belong after Redis/session wiring.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.2.0' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('DB error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TaskFlow API running on port ${PORT}`);
});

module.exports = app;
