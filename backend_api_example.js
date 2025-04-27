// Backend API Example using Node.js with Express and File-based Storage

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// File paths for storage
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, 'activity_log.json');

// Admin emails (replace with your actual admin emails)
const ADMIN_EMAILS = ['youradmin@example.com']; 

// Ensure data directory exists
async function initializeStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Initialize users file if it doesn't exist
    try {
      await fs.access(USERS_FILE);
    } catch (err) {
      await fs.writeFile(USERS_FILE, JSON.stringify([]));
    }
    
    // Initialize activity log file if it doesn't exist
    try {
      await fs.access(ACTIVITY_LOG_FILE);
    } catch (err) {
      await fs.writeFile(ACTIVITY_LOG_FILE, JSON.stringify([]));
    }
    
    console.log('Storage initialized successfully');
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

// Helper functions for data access
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
}

async function writeUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users:', error);
    throw error;
  }
}

async function readActivityLog() {
  try {
    const data = await fs.readFile(ACTIVITY_LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading activity log:', error);
    return [];
  }
}

async function writeActivityLog(logs) {
  try {
    await fs.writeFile(ACTIVITY_LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error writing activity log:', error);
    throw error;
  }
}

async function addActivityLog(log) {
  try {
    const logs = await readActivityLog();
    logs.push(log);
    
    // Limit the log size to prevent file from growing too large
    const maxLogs = 10000;
    const trimmedLogs = logs.length > maxLogs ? logs.slice(-maxLogs) : logs;
    
    await writeActivityLog(trimmedLogs);
  } catch (error) {
    console.error('Error adding activity log:', error);
    throw error;
  }
}

// API Routes

// Register a new extension user
app.post('/register-extension-user', async (req, res) => {
  try {
    const { email, installDate, browser, extensionVersion } = req.body;
    
    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid email is required' 
      });
    }
    
    // Read existing users
    const users = await readUsers();
    
    // Check if user already exists
    const existingUserIndex = users.findIndex(u => u.email === email);
    
    if (existingUserIndex !== -1) {
      // Update existing user
      users[existingUserIndex] = {
        ...users[existingUserIndex],
        lastActive: new Date().toISOString(),
        browser: browser || users[existingUserIndex].browser,
        extensionVersion: extensionVersion || users[existingUserIndex].extensionVersion
      };
    } else {
      // Add new user
      users.push({
        email,
        installDate: installDate || new Date().toISOString(),
        lastActive: new Date().toISOString(),
        browser,
        extensionVersion,
        activityCount: 0
      });
    }
    
    // Save updated users
    await writeUsers(users);
    
    return res.json({ 
      success: true, 
      message: 'User registered successfully' 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error during registration' 
    });
  }
});

// Log user activity
app.post('/log-extension-activity', async (req, res) => {
  try {
    const { email, action, timestamp, details } = req.body;
    
    if (!email || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and action are required' 
      });
    }
    
    // Log the activity
    await addActivityLog({
      email,
      action,
      timestamp: timestamp || new Date().toISOString(),
      details: details || {}
    });
    
    // Update user's activity count and last active time
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex !== -1) {
      users[userIndex].lastActive = new Date().toISOString();
      users[userIndex].activityCount = (users[userIndex].activityCount || 0) + 1;
      await writeUsers(users);
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Activity logging error:', error);
    // Even if there's an error, return success to prevent disrupting the user experience
    return res.json({ success: true });
  }
});

// Admin endpoint to get user list
app.post('/admin/users', async (req, res) => {
  try {
    const { adminEmail } = req.body;
    
    // Verify that requester is an admin
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access' 
      });
    }
    
    // Get all users
    const users = await readUsers();
    
    // Calculate statistics
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const totalUsers = users.length;
    const activeLastWeek = users.filter(user => {
      const lastActiveDate = new Date(user.lastActive);
      return lastActiveDate >= oneWeekAgo;
    }).length;
    
    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeLastWeek
      },
      users: users.sort((a, b) => new Date(b.installDate) - new Date(a.installDate))
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error fetching user data' 
    });
  }
});

// Start the server
async function startServer() {
  // Initialize storage before starting the server
  await initializeStorage();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
});