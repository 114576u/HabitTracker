# Habit Tracker (Flask)

A simple habit tracker built with **Python + Flask**, using a plain **JSON file** for persistence.

## Features
- Add habits (checkbox or metrics)
- Toggle completion per day
- Enter metrics for specific habits
- Data stored in `habits.json`

## Setup

```bash
# clone repo
cd flask-habit-tracker

# create venv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# install deps
pip install -r requirements.txt

# run app
python app.py
```

Visit http://127.0.0.1:5000

## Notes
- All data is stored in `habits.json` in the project root.
- Extendable to SQLite or Postgres in the future.
