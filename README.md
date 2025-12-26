# 🎓 Study Matcher

A full-stack web application that connects university students with study partners based on shared courses.

![Study Matcher Demo](https://via.placeholder.com/800x400?text=Add+Screenshot+Here)

## 🚀 Features

- **Secure Authentication**: JWT-based login system with encrypted passwords
- **Course Management**: Add and remove courses you need help with
- **Smart Matching**: Find study partners taking the same courses
- **User Profiles**: Manage your academic information
- **Search & Filter**: Find students by name, major, or courses

## 🛠️ Tech Stack

**Frontend:**
- React
- Axios
- Vite

**Backend:**
- Node.js
- Express
- SQLite
- JWT (jsonwebtoken)
- bcrypt

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm

### Backend Setup

1. Clone the repository
```bash
git clone https://github.com/SohamxP/study-matcher.git
cd study-matcher
```

2. Install dependencies
```bash
npm install
```

3. Start the backend server
```bash
node server.js
```

Backend runs on `http://localhost:3000`

### Frontend Setup

1. Navigate to frontend directory
```bash
cd frontend
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

## 🎯 API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login

### Users
- `GET /api/users` - Get all users
- `GET /api/users/search` - Search users with filters
- `PUT /api/users/:id` - Update user (protected)
- `DELETE /api/users/:id` - Delete user (protected)

### Courses
- `POST /api/users/:id/courses` - Add course (protected)
- `DELETE /api/users/:id/courses/:courseName` - Remove course (protected)

### Matching
- `GET /api/matches/:courseName` - Find study partners by course

## 📸 Screenshots


## 🔒 Security Features

- Passwords hashed with bcrypt (10 salt rounds)
- JWT token-based authentication
- Protected routes requiring valid tokens
- Authorization checks (users can only modify their own data)
- Input validation on all endpoints

## 🚧 Future Enhancements

- Real-time chat between matched students
- Email notifications for new matches
- Calendar integration for study sessions
- Mobile app version
- User ratings and reviews

## 👨‍💻 Author

**Your Name**
- GitHub: [@SohamxP](https://github.com/SohamxP)
- LinkedIn: [Soham Panchal](https://linkedin.com/in/soham-panchal/)
- Email: work.panchalsoham@example.com

## 📄 License

This project is open source and available under the MIT License.
