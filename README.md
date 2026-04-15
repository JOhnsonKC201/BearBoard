# BearBoard

Campus community board for Morgan State University.  
COSC 458 Software Engineering - Spring 2026

## Project Structure

```
BearBoard/
├── backend/          # FastAPI backend (Python)
│   ├── main.py       # App entry point
│   ├── routers/      # API route handlers
│   ├── models/       # SQLAlchemy database models
│   ├── schemas/      # Pydantic request/response schemas
│   ├── services/     # Business logic
│   ├── core/         # Config, database setup
│   └── agents/       # AI agent scaffolding
├── frontend/         # React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── api/
│   └── index.html
├── DEVELOPER_TASKS.txt   # Task list for each developer
└── README.md
```

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
API docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Dev server: http://localhost:3000

## Team

- **Kyndal Maclin** Product Owner
- **Oluwajomiloju King** Scrum Master
- **Aayush Shrestha** API, AI Agent & Backend
- **Johnson KC** Full Stack (Database, Auth, Profile)
- **Sameer Shiwakoti** Frontend / UI
- **Rohan Sainju** UI/UX Design & Experience
