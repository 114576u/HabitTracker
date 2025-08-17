
# Habit Tracker — Flask + SQLite + Login + Media Journal + Ratings + Tags + Reports

New: **Reports page** with weekly/monthly/yearly ranges, sorting, and tag filter.

## Reports
- Navigate to **Reports** in the header.
- Controls:
  - **Period**: week / month / year
  - **Start date**: base date (week → Mon–Sun around this date; month/year → matching calendar period)
  - **Sort by**: date, habit, category, rating (desc for rating; unrated last)
  - **Filter by tag**: optional (matches habit tags for habit rows, entry tags for journal rows)

The table includes:
- **Habits**: date, habit name, kind, done, time min, distance km, tags
- **Journal**: date, title, category, done, rating, tags, link

## Run
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Open `http://127.0.0.1:5000` and use **Reports**.
