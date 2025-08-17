
# Habit Tracker — Flask + SQLite + Login (Option 3)

This version adds **user accounts** (register/login/logout) with **Flask-Login** and **SQLite** via SQLAlchemy.
Each user has their own habits and records.

## Features
- User registration and login (passwords hashed with Werkzeug)
- SQLite database (`app.db` by default)
- Calendar month view, select a day to log activity
- Habit types: Checkbox or Metrics (Time min + Distance km)
- Per-day toggle (checkbox) or metric entry
- Simple, clean UI (no build tools)

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate  # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
# open http://127.0.0.1:5000
```

On first run, tables are created automatically. Register a user, log in, then add habits.

## Configuration
- `SECRET_KEY`: set an env var for sessions in production
- `DATABASE_URL`: override to use another SQLite path or Postgres URL

Examples:
```bash
export SECRET_KEY='change-me'
export DATABASE_URL='sqlite:///app.db'   # default
python app.py
```

## Tech
- Flask, Flask-Login, Flask-SQLAlchemy
- SQLite for storage
- Werkzeug for password hashing
