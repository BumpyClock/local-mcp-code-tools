/**
 * Main entry point for test project
 */

import express from 'express';

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the MCP test project!' });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'operational',
    time: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
