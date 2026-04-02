# TaskFlow API

A lightweight REST API for task and project 
management. Built with Node.js, Express, 
and MongoDB.

## Features
- JWT-based authentication
- Full task CRUD operations
- User profile management
- Role-based access control

## Quick Start
```bash
npm install
cp .env.example .env
npm run dev
```

## API Endpoints
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/tasks
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
GET    /api/users/profile
PUT    /api/users/profile
```

## Tech Stack
- Runtime: Node.js v18+
- Framework: Express 4.18
- Database: MongoDB + Mongoose
- Auth: JSON Web Tokens (JWT)
- Testing: Jest
- Linting: ESLint

## Environment Variables
See `.env.example` for required variables.

## Contributing
See CONTRIBUTING.md for guidelines.
