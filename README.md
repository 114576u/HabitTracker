# Habit Tracker — Flask + SQLite + Login + Media Journal + Ratings + Tags

New in this build:
- **Ratings** (0–5, optional) per Journal entry.
- **Tags**: unlimited tags per user, attachable to **habits** and **journal entries**.
  - Creating a new tag anywhere (habit or entry) implicitly creates it for the user.

## Run
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
# http://127.0.0.1:5000
```

## API highlights
- `GET /api/tags` → list existing tag names
- Habit tags:
  - `POST /api/habits/add` with `tags: [str]`
  - `POST /api/habits/tags` with `{ id, tags: [str] }`
- Media entries:
  - `POST /api/media/add` with `tags: [str]`, `rating: 0..5|null`
  - `POST /api/media/update` can set `tags` and `rating`
