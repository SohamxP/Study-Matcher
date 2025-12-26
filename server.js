const express = require('express'); 
const db = require('./database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Secret key for JWT (in real apps, put this in environment variables)
const JWT_SECRET = 'your-secret-key-change-this-later';

// Homepage
app.get('/', (req, res) => {
  res.send('Study Matcher API with Authentication!');
});

// REGISTER with password
app.post('/api/users/register', async (req, res) => {
  const { name, email, password, major } = req.body;
  
  // Validate input
  if (!name || !email || !password || !major) {
    return res.status(400).json({ error: 'All fields required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Save to database
    const sql = 'INSERT INTO users (name, email, password, major) VALUES (?, ?, ?, ?)';
    
    db.run(sql, [name, email, hashedPassword, major], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      // Create a token
      const token = jwt.sign({ userId: this.lastID, email }, JWT_SECRET, { expiresIn: '24h' });
      
      // Get the user (without password!)
      db.get('SELECT id, name, email, major, created_at FROM users WHERE id = ?', [this.lastID], (err, user) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: 'User created!', 
          user,
          token // Send token so they're automatically logged in
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN endpoint
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // Find user by email
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Create token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    // Send user info (without password) and token
    res.json({
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        major: user.major
      },
      token
    });
  });
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // Add user info to request
    next();
  });
};

// GET all users (public - no auth needed)
app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, major, created_at FROM users', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const promises = users.map(user => {
      return new Promise((resolve) => {
        db.all(
          'SELECT course_name FROM user_courses WHERE user_id = ?',
          [user.id],
          (err, courses) => {
            user.courses = courses ? courses.map(c => c.course_name) : [];
            resolve(user);
          }
        );
      });
    });
    
    Promise.all(promises).then(usersWithCourses => {
      res.json(usersWithCourses);
    });
  });
});

// ADD course (now requires authentication!)
app.post('/api/users/:userId/courses', authenticateToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const { courseName } = req.body;
  
  // Check if user is modifying their own account
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only add courses to your own account' });
  }
  
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const sql = 'INSERT INTO user_courses (user_id, course_name) VALUES (?, ?)';
    db.run(sql, [userId, courseName], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'User already has this course' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      db.all(
        'SELECT course_name FROM user_courses WHERE user_id = ?',
        [userId],
        (err, courses) => {
          res.json({ 
            message: 'Course added!', 
            courses: courses.map(c => c.course_name)
          });
        }
      );
    });
  });
});

// FIND matches (public - no auth needed)
app.get('/api/matches/:courseName', (req, res) => {
  const courseName = req.params.courseName;
  
  const sql = `
    SELECT DISTINCT u.id, u.name, u.email, u.major, u.created_at
    FROM users u
    JOIN user_courses uc ON u.id = uc.user_id
    WHERE uc.course_name = ?
  `;
  
  db.all(sql, [courseName], (err, users) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const promises = users.map(user => {
      return new Promise((resolve) => {
        db.all(
          'SELECT course_name FROM user_courses WHERE user_id = ?',
          [user.id],
          (err, courses) => {
            user.courses = courses ? courses.map(c => c.course_name) : [];
            resolve(user);
          }
        );
      });
    });
    
    Promise.all(promises).then(usersWithCourses => {
      res.json({ course: courseName, matches: usersWithCourses });
    });
  });
});

// DELETE your own account (protected)
app.delete('/api/users/:userId', authenticateToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  
  // Check if user is deleting their own account
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only delete your own account' });
  }
  
  // First delete all their courses
  db.run('DELETE FROM user_courses WHERE user_id = ?', [userId], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Then delete the user
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'Account deleted successfully' });
    });
  });
});

// REMOVE a course from your account (protected)
app.delete('/api/users/:userId/courses/:courseName', authenticateToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const courseName = req.params.courseName;
  
  // Check if user is modifying their own account
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only remove courses from your own account' });
  }
  
  const sql = 'DELETE FROM user_courses WHERE user_id = ? AND course_name = ?';
  
  db.run(sql, [userId, courseName], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Course not found or already removed' });
    }
    
    // Get remaining courses
    db.all(
      'SELECT course_name FROM user_courses WHERE user_id = ?',
      [userId],
      (err, courses) => {
        res.json({ 
          message: 'Course removed!', 
          remainingCourses: courses.map(c => c.course_name)
        });
      }
    );
  });
});

// UPDATE your account info (protected)
app.put('/api/users/:userId', authenticateToken, (req, res) => {
  const userId = parseInt(req.params.userId);
  const { name, email, major } = req.body;
  
  // Check if user is updating their own account
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only update your own account' });
  }
  
  // Build SQL dynamically based on what fields are provided
  const updates = [];
  const values = [];
  
  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (email) {
    updates.push('email = ?');
    values.push(email);
  }
  if (major) {
    updates.push('major = ?');
    values.push(major);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(userId); // Add userId for WHERE clause
  
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  
  db.run(sql, values, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get updated user
    db.get('SELECT id, name, email, major, created_at FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'User updated!', user });
    });
  });
});

// SEARCH users with filters (public)
app.get('/api/users/search', (req, res) => {
  const { name, email, major } = req.query;
  
  let sql = 'SELECT id, name, email, major, created_at FROM users WHERE 1=1';
  const params = [];
  
  if (name) {
    sql += ' AND name LIKE ?';
    params.push(`%${name}%`); // % means "contains"
  }
  
  if (email) {
    sql += ' AND email LIKE ?';
    params.push(`%${email}%`);
  }
  
  if (major) {
    sql += ' AND major LIKE ?';
    params.push(`%${major}%`);
  }
  
  db.all(sql, params, (err, users) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get courses for each user
    const promises = users.map(user => {
      return new Promise((resolve) => {
        db.all(
          'SELECT course_name FROM user_courses WHERE user_id = ?',
          [user.id],
          (err, courses) => {
            user.courses = courses ? courses.map(c => c.course_name) : [];
            resolve(user);
          }
        );
      });
    });
    
    Promise.all(promises).then(usersWithCourses => {
      res.json({ 
        count: usersWithCourses.length,
        users: usersWithCourses 
      });
    });
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});