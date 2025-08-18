
# Habit Tracker — Flask + SQLite + Login + Tags/Ratings + Reports + Monthly Goals + Calendar Activity

**New in this build**
- Calendar highlights days with **any activity** (habit record or journal entry) using a light-blue background.
- **Monthly goals per habit**: set on create and edit later; Reports show progress for the selected month.
- Full auth + media journal (with tags & ratings), tag filtering, sortable reports.

## Run
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
# open http://127.0.0.1:5000
```

## Notes
- Endpoint: `GET /api/activity?month=YYYY-MM` returns per-day activity counts for the calendar view.
- Endpoint: `GET /api/reports` supports period (week|month|year), base start date, sort (date|habit|category|rating), and tag filter.
- Habit creation accepts `monthlyGoal`; update via `POST /api/habits/goal`.
