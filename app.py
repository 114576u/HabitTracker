# Create an improved Flask project with a calendar-based day selector
import os, zipfile, json, textwrap

project = "flask-habit-tracker-calendar"
base = f"/mnt/data/{project}"
os.makedirs(base, exist_ok=True)
os.makedirs(f"{base}/templates", exist_ok=True)
os.makedirs(f"{base}/static", exist_ok=True)

from flask import Flask, render_template, request, jsonify
import json, os
from datetime import date
from uuid import uuid4

app = Flask(__name__)
DATA_FILE = os.environ.get("HABITS_DATA_FILE", "habits.json")

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"habits": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DATA_FILE)

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/data")
def api_data():
    data = load_data()
    return jsonify({"today": date.today().isoformat(), "habits": data.get("habits", [])})

@app.post("/api/habits/add")
def api_add():
    payload = request.json or {}
    name = (payload.get("name") or "").strip()
    kind = payload.get("kind") or "checkbox"
    color = payload.get("color") or "#6366f1"
    if not name:
        return jsonify({"error": "name required"}), 400
    data = load_data()
    hid = str(uuid4())
    data["habits"].append({
        "id": hid,
        "name": name,
        "kind": kind,
        "color": color,
        "records": {}
    })
    save_data(data)
    return jsonify({"ok": True, "id": hid})

@app.post("/api/habits/delete")
def api_delete():
    payload = request.json or {}
    hid = payload.get("id")
    data = load_data()
    data["habits"] = [h for h in data.get("habits", []) if h.get("id") != hid]
    save_data(data)
    return jsonify({"ok": True})

@app.post("/api/toggle")
def api_toggle():
    payload = request.json or {}
    hid = payload.get("id")
    day = payload.get("date")
    if not (hid and day):
        return jsonify({"error": "id and date required"}), 400
    data = load_data()
    for h in data.get("habits", []):
        if h.get("id") == hid:
            recs = h.setdefault("records", {})
            cur = recs.get(day, False)
            if isinstance(cur, bool):
                recs[day] = not cur
            elif isinstance(cur, dict):
                cur["done"] = not bool(cur.get("done"))
                recs[day] = cur
            else:
                recs[day] = True
            break
    save_data(data)
    return jsonify({"ok": True})

@app.post("/api/metrics")
def api_metrics():
    payload = request.json or {}
    hid = payload.get("id")
    day = payload.get("date")
    metrics = payload.get("metrics", {})
    if not (hid and day):
        return jsonify({"error": "id and date required"}), 400
    # done if any metric > 0
    try:
        done = any(float(v or 0) > 0 for v in metrics.values())
    except Exception:
        done = False
    data = load_data()
    for h in data.get("habits", []):
        if h.get("id") == hid:
            recs = h.setdefault("records", {})
            recs[day] = {"done": done, "metrics": metrics}
            break
    save_data(data)
    return jsonify({"ok": True})

@app.post("/api/clear")
def api_clear():
    payload = request.json or {}
    hid = payload.get("id")
    day = payload.get("date")
    data = load_data()
    for h in data.get("habits", []):
        if h.get("id") == hid:
            recs = h.setdefault("records", {})
            if day in recs:
                del recs[day]
            break
    save_data(data)
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(debug=True)