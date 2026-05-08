require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/chats', require('./routes/chat'));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Nyay Mitra running at http://localhost:${PORT}`);
});
