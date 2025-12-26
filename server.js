const express = require('express');
const db = require('./database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-later';

// Homepage
app.get('/', (req, res) => {
  res.send('Study Matcher API with Authentication!');
});

// REGISTER
app.post('/api/users/register', async (req, res) => {
  const { name, email, password, major } = req.body;
  
  if (!name || !email || !password || !major) {
    return res.status(400).json({ error: 'All fields required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      'INSERT INTO users (name, email, password, major) VALUES ($1, $2, $3, $4) RETURNING id, name, email, major, created_at',
      [name, email, hashedPassword, major]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ message: 'User created!', user, token });
  } catch (err) {
    if (err.constraint === 'users_email_key') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      message: 'Login successful!',
      user: { id: user.id, name: user.name, email: user.email, major: user.major },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// GET all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.major, u.created_at,
             COALESCE(array_agg(uc.course_name) FILTER (WHERE uc.course_name IS NOT NULL), '{}') as courses
      FROM users u
      LEFT JOIN user_courses uc ON u.id = uc.user_id
      GROUP BY u.id
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single user
app.get('/api/users/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.major, u.created_at,
             COALESCE(array_agg(uc.course_name) FILTER (WHERE uc.course_name IS NOT NULL), '{}') as courses
      FROM users u
      LEFT JOIN user_courses uc ON u.id = uc.user_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ADD course (protected)
app.post('/api/users/:userId/courses', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { courseName } = req.body;
  
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only add courses to your own account' });
  }
  
  try {
    await db.query(
      'INSERT INTO user_courses (user_id, course_name) VALUES ($1, $2)',
      [userId, courseName]
    );
    
    const result = await db.query(
      'SELECT course_name FROM user_courses WHERE user_id = $1',
      [userId]
    );
    
    res.json({ 
      message: 'Course added!', 
      courses: result.rows.map(r => r.course_name)
    });
  } catch (err) {
    if (err.constraint === 'user_courses_user_id_course_name_key') {
      return res.status(400).json({ error: 'User already has this course' });
    }
    console.error('Add course error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REMOVE course (protected)
app.delete('/api/users/:userId/courses/:courseName', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const courseName = req.params.courseName;
  
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only remove courses from your own account' });
  }
  
  try {
    const result = await db.query(
      'DELETE FROM user_courses WHERE user_id = $1 AND course_name = $2',
      [userId, courseName]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Course not found or already removed' });
    }
    
    const courses = await db.query(
      'SELECT course_name FROM user_courses WHERE user_id = $1',
      [userId]
    );
    
    res.json({ 
      message: 'Course removed!', 
      remainingCourses: courses.rows.map(r => r.course_name)
    });
  } catch (err) {
    console.error('Remove course error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE user (protected)
app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { name, email, major } = req.body;
  
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only update your own account' });
  }
  
  const updates = [];
  const values = [];
  let paramCount = 1;
  
  if (name) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (email) {
    updates.push(`email = $${paramCount++}`);
    values.push(email);
  }
  if (major) {
    updates.push(`major = $${paramCount++}`);
    values.push(major);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(userId);
  
  try {
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    
    const result = await db.query(
      'SELECT id, name, email, major, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    res.json({ message: 'User updated!', user: result.rows[0] });
  } catch (err) {
    if (err.constraint === 'users_email_key') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE user (protected)
app.delete('/api/users/:userId', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'You can only delete your own account' });
  }
  
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1', [userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// SEARCH users
app.get('/api/users/search', async (req, res) => {
  const { name, email, major } = req.query;
  
  let conditions = [];
  let values = [];
  let paramCount = 1;
  
  if (name) {
    conditions.push(`u.name ILIKE $${paramCount++}`);
    values.push(`%${name}%`);
  }
  if (email) {
    conditions.push(`u.email ILIKE $${paramCount++}`);
    values.push(`%${email}%`);
  }
  if (major) {
    conditions.push(`u.major ILIKE $${paramCount++}`);
    values.push(`%${major}%`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.major, u.created_at,
             COALESCE(array_agg(uc.course_name) FILTER (WHERE uc.course_name IS NOT NULL), '{}') as courses
      FROM users u
      LEFT JOIN user_courses uc ON u.id = uc.user_id
      ${whereClause}
      GROUP BY u.id
    `, values);
    
    res.json({ count: result.rows.length, users: result.rows });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// FIND matches
app.get('/api/matches/:courseName', async (req, res) => {
  const courseName = req.params.courseName;
  
  try {
    const result = await db.query(`
      SELECT DISTINCT u.id, u.name, u.email, u.major, u.created_at,
             array_agg(uc2.course_name) as courses
      FROM users u
      JOIN user_courses uc ON u.id = uc.user_id
      LEFT JOIN user_courses uc2 ON u.id = uc2.user_id
      WHERE uc.course_name = $1
      GROUP BY u.id
    `, [courseName]);
    
    res.json({ course: courseName, matches: result.rows });
  } catch (err) {
    console.error('Find matches error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});