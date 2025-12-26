import { useState, useEffect } from 'react';
import { getAllUsers, addCourse, findMatches } from './api';

function Dashboard({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [newCourse, setNewCourse] = useState('');
  const [searchCourse, setSearchCourse] = useState('');
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await getAllUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.trim()) return;

    try {
      await addCourse(user.id, newCourse);
      setNewCourse('');
      loadUsers();
      alert('Course added!');
    } catch (err) {
      alert(err.response?.data?.error || 'Error adding course');
    }
  };

  const handleFindMatches = async (e) => {
    e.preventDefault();
    if (!searchCourse.trim()) return;

    try {
      const response = await findMatches(searchCourse);
      setMatches(response.data.matches);
    } catch (err) {
      alert('Error finding matches');
    }
  };

  const currentUser = users.find(u => u.id === user.id) || user;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🎓 Study Matcher</h1>
        <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      <div style={styles.content}>
        {/* Profile Card */}
        <div style={styles.card}>
          <h2>👤 Your Profile</h2>
          <p><strong>Name:</strong> {currentUser.name}</p>
          <p><strong>Email:</strong> {currentUser.email}</p>
          <p><strong>Major:</strong> {currentUser.major}</p>
          <p><strong>Courses:</strong> {currentUser.courses?.join(', ') || 'None yet'}</p>
        </div>

        {/* Add Course */}
        <div style={styles.card}>
          <h2>➕ Add a Course</h2>
          <form onSubmit={handleAddCourse} style={styles.form}>
            <input
              type="text"
              placeholder="e.g., Data Structures"
              value={newCourse}
              onChange={(e) => setNewCourse(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.button}>Add Course</button>
          </form>
        </div>

        {/* Find Matches */}
        <div style={styles.card}>
          <h2>🔍 Find Study Partners</h2>
          <form onSubmit={handleFindMatches} style={styles.form}>
            <input
              type="text"
              placeholder="Search by course name"
              value={searchCourse}
              onChange={(e) => setSearchCourse(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.button}>Search</button>
          </form>

          {matches.length > 0 && (
            <div style={styles.matchesContainer}>
              <h3>Found {matches.length} match(es):</h3>
              {matches.map(match => (
                <div key={match.id} style={styles.matchCard}>
                  <p><strong>{match.name}</strong></p>
                  <p>{match.email}</p>
                  <p>Major: {match.major}</p>
                  <p>Courses: {match.courses.join(', ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f7fa',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutBtn: {
    padding: '10px 20px',
    background: 'white',
    color: '#667eea',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  content: {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gap: '20px',
  },
  card: {
    background: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  form: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
  },
  input: {
    flex: 1,
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
  },
  button: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  matchesContainer: {
    marginTop: '20px',
  },
  matchCard: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    marginTop: '10px',
  },
};

export default Dashboard;