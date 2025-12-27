import axios from 'axios';

const API_URL = 'https://study-matcher-backend.onrender.com';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth functions
export const register = (userData) => api.post('/users/register', userData);
export const login = (credentials) => api.post('/users/login', credentials);

// User functions
export const getAllUsers = () => api.get('/users');
export const updateUser = (userId, data) => api.put(`/users/${userId}`, data);
export const deleteUser = (userId) => api.delete(`/users/${userId}`);

// Course functions
export const addCourse = (userId, courseName) => 
  api.post(`/users/${userId}/courses`, { courseName });
export const removeCourse = (userId, courseName) => 
  api.delete(`/users/${userId}/courses/${courseName}`);

// Match functions
export const findMatches = (courseName) => api.get(`/matches/${courseName}`);

export default api;