# 🧠 Habit Tracker — Flask + SQLite + Login + Tags + Ratings + Calendar + Reports + Goals

A lightweight but powerful **Habit Tracker Web App** built using **Flask** and **SQLite**, with user login, habit tagging, progress reports, mood tracking, and calendar activity view.

---

## 🚀 Features

✅ **User Authentication**  
Secure login and registration system per user session.

✅ **Habit Logging with Tags**  
Create daily habit entries and associate **tags** (e.g. `health`, `study`, `meditation`) for flexible tracking and reporting.

✅ **Journal Entries with Media and Ratings**  
Add optional **mood ratings** and **journal notes** to each habit entry.

✅ **Calendar with Activity Highlights**  
View a calendar where any day with activity (habit or journal) is marked. Easily track streaks and consistency.

✅ **Monthly Goals per Habit**  
Set and edit **monthly goals** for each habit. Progress is shown in reports.

✅ **Reports Dashboard**  
Dynamic reports with filtering:
- By **week**, **month**, or **year**
- Sorted by **date**, **habit**, **category**, or **rating**
- Filterable by **tag**

✅ **REST API Endpoints**  
Programmatic access to activity data and reports.

---

## 🛠️ Installation & Run

```bash
# Create a virtual environment
python -m venv .venv
source .venv/bin/activate      # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the Flask app
python app.py

# Open in your browser
http://127.0.0.1:5000
