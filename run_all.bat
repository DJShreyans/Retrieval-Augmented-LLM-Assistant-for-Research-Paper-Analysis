@echo off
echo Starting ResearchMate Full System (Backend + Frontend)...
start "ResearchMate Backend" cmd /k "run_backend.bat"
start "ResearchMate Frontend" cmd /k "run_frontend.bat"
echo Both servers initiated.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
