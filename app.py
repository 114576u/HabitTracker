
from __future__ import annotations
from flask import Flask, render_template, request, redirect, url_for, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime, timedelta
from sqlalchemy import func, text
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# ------------- Models -------------

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    habits = db.relationship('Habit', backref='user', lazy=True, cascade='all, delete-orphan')
    media_entries = db.relationship('MediaEntry', backref='user', lazy=True, cascade='all, delete-orphan')
    tags = db.relationship('Tag', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

class Habit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    kind = db.Column(db.String(50), nullable=False, default='checkbox')  # 'checkbox' | 'metrics' | 'numeric'
    color = db.Column(db.String(20), nullable=False, default='#6366f1')
    monthly_goal = db.Column(db.Integer, nullable=True)  # times per month (days with activity)
    # Numeric config
    unit = db.Column(db.String(20), nullable=True)
    aggregation = db.Column(db.String(10), nullable=True)
    daily_goal = db.Column(db.Float, nullable=True)
    allow_multi = db.Column(db.Boolean, default=False, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)
    records = db.relationship('Record', backref='habit', lazy=True, cascade='all, delete-orphan')
    tags = db.relationship('Tag', secondary='habit_tag', back_populates='habits')

class Record(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False, index=True)
    date = db.Column(db.String(10), nullable=False, index=True)  # YYYY-MM-DD
    done = db.Column(db.Boolean, default=False, nullable=False)
    time_min = db.Column(db.Float, nullable=True)      # for metrics habits
    distance_km = db.Column(db.Float, nullable=True)   # for metrics habits
    value = db.Column(db.Float, nullable=True)         # for numeric (non-multi)
    __table_args__ = (db.UniqueConstraint('habit_id', 'date', name='uniq_habit_date'), )

class MediaEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    date = db.Column(db.String(10), nullable=False, index=True)
    checked = db.Column(db.Boolean, default=False, nullable=False)
    text = db.Column(db.String(500), nullable=False)
    link = db.Column(db.String(1000), nullable=True)
    category = db.Column(db.String(50), nullable=True)
    rating = db.Column(db.Integer, nullable=True)  # 0..5
    tags = db.relationship('Tag', secondary='media_entry_tag', back_populates='media_entries')

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    __table_args__ = (db.UniqueConstraint('user_id', 'name', name='uniq_user_tagname'), )
    habits = db.relationship('Habit', secondary='habit_tag', back_populates='tags')
    media_entries = db.relationship('MediaEntry', secondary='media_entry_tag', back_populates='tags')

class HabitTag(db.Model):
    __tablename__ = 'habit_tag'
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tag.id'), primary_key=True)

class MediaEntryTag(db.Model):
    __tablename__ = 'media_entry_tag'
    media_entry_id = db.Column(db.Integer, db.ForeignKey('media_entry.id'), primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tag.id'), primary_key=True)

@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, int(user_id))
    except Exception:
        return None

# ------------- Helpers -------------

def init_db():
    with app.app_context():
        db.create_all()
        # Add/ensure columns for Habit
        try:
            cols = [c['name'] for c in db.session.execute(text("PRAGMA table_info(habit)")).mappings().all()]
            alter = []
            if 'monthly_goal' not in cols: alter.append("ALTER TABLE habit ADD COLUMN monthly_goal INTEGER")
            if 'unit' not in cols: alter.append("ALTER TABLE habit ADD COLUMN unit TEXT")
            if 'aggregation' not in cols: alter.append("ALTER TABLE habit ADD COLUMN aggregation TEXT")
            if 'daily_goal' not in cols: alter.append("ALTER TABLE habit ADD COLUMN daily_goal REAL")
            if 'allow_multi' not in cols: alter.append("ALTER TABLE habit ADD COLUMN allow_multi INTEGER DEFAULT 0")
            if 'active' not in cols: alter.append("ALTER TABLE habit ADD COLUMN active INTEGER DEFAULT 1")
            for stmt in alter:
                db.session.execute(text(stmt))
            if alter: db.session.commit()
        except Exception:
            pass
        # Add value column to Record
        try:
            cols = [c['name'] for c in db.session.execute(text("PRAGMA table_info(record)")).mappings().all()]
            if 'value' not in cols:
                db.session.execute(text("ALTER TABLE record ADD COLUMN value REAL"))
                db.session.commit()
        except Exception:
            pass
        # Create numeric_entry table if missing
        try:
            db.session.execute(text("SELECT 1 FROM numeric_entry LIMIT 1"))
        except Exception:
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS numeric_entry (
                    id INTEGER PRIMARY KEY,
                    habit_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    value REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(habit_id) REFERENCES habit(id)
                )
            """))
            db.session.commit()

def get_or_create_tags(user_id: int, names):
    clean = [n.strip() for n in (names or []) if n and n.strip()]
    if not clean:
        return []
    seen = set(); unique = []
    for n in clean:
        key = n.lower()
        if key not in seen:
            seen.add(key); unique.append(n)
    existing = Tag.query.filter(Tag.user_id==user_id, Tag.name.in_(unique)).all()
    existing_names = {t.name for t in existing}
    to_create = [n for n in unique if n not in existing_names]
    for n in to_create:
        t = Tag(user_id=user_id, name=n)
        db.session.add(t); existing.append(t)
    if to_create: db.session.commit()
    return existing

def parse_date(s: str) -> date:
    return datetime.strptime(s, '%Y-%m-%d').date()

# ------------- Views -------------

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/reports')
@login_required
def reports_page():
    return render_template('reports.html')

# -------- Auth --------

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = (request.form.get('email') or '').strip().lower()
        password = request.form.get('password') or ''
        if not email or not password:
            flash('Email and password are required', 'error')
            return redirect(url_for('register'))
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return redirect(url_for('register'))
        user = User(email=email); user.set_password(password)
        db.session.add(user); db.session.commit()
        flash('Registration successful. Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = (request.form.get('email') or '').strip().lower()
        password = request.form.get('password') or ''
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user); return redirect(url_for('index'))
        flash('Invalid email or password', 'error')
        return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user(); return redirect(url_for('login'))

# -------- API: tags --------

@app.get('/api/tags')
@login_required
def api_tags():
    tags = Tag.query.filter_by(user_id=current_user.id).order_by(Tag.name.asc()).all()
    return jsonify([t.name for t in tags])

# -------- API: data --------

@app.get('/api/data')
@login_required
def api_data():
    habits = Habit.query.filter_by(user_id=current_user.id, active=True).all()
    payload = []
    for h in habits:
        rec_map = {}
        for r in h.records:
            if h.kind == 'checkbox':
                rec_map[r.date] = bool(r.done)
            elif h.kind == 'metrics':
                rec_map[r.date] = {'done': bool(r.done), 'metrics': {'timeMin': r.time_min or 0, 'distanceKm': r.distance_km or 0}}
            elif h.kind == 'numeric' and not h.allow_multi:
                rec_map[r.date] = {'value': r.value or 0}
        if h.kind == 'numeric' and h.allow_multi:
            rows = db.session.execute(text("SELECT date, SUM(value) as total FROM numeric_entry WHERE habit_id = :hid GROUP BY date"), { 'hid': h.id }).mappings().all()
            for row in rows:
                rec_map[row['date']] = {'value': row['total'] or 0}
        payload.append({
            'id': h.id, 'name': h.name, 'kind': h.kind, 'color': h.color,
            'monthlyGoal': h.monthly_goal,
            'active': bool(h.active),
            'tags': [t.name for t in h.tags],
            'records': rec_map
        })
    return jsonify({'today': date.today().isoformat(), 'habits': payload})

# -------- API: activity (calendar heat base) --------

@app.get('/api/activity')
@login_required
def api_activity():
    month = request.args.get('month')  # YYYY-MM
    if not month or len(month) != 7:
        return jsonify({'error': 'month=YYYY-MM required'}), 400
    year, mon = month.split('-')
    try:
        y = int(year); m = int(mon)
        start_date = date(y, m, 1)
        if m == 12:
            end_date = date(y, 12, 31)
        else:
            end_date = date(y, m+1, 1) - timedelta(days=1)
    except Exception:
        return jsonify({'error': 'invalid month'}), 400
    s = start_date.strftime('%Y-%m-%d'); e = end_date.strftime('%Y-%m-%d')

    # Habit records grouped by date for current user
    rec_counts = dict(
        db.session.query(Record.date, func.count(Record.id))
          .join(Habit, Record.habit_id == Habit.id)
          .filter(Habit.user_id == current_user.id, Record.date >= s, Record.date <= e)
          .group_by(Record.date).all()
    )
    # Media entries grouped by date
    me_counts = dict(
        db.session.query(MediaEntry.date, func.count(MediaEntry.id))
          .filter(MediaEntry.user_id == current_user.id, MediaEntry.date >= s, MediaEntry.date <= e)
          .group_by(MediaEntry.date).all()
    )
    date_counts = {}
    for k, v in rec_counts.items():
        date_counts[k] = date_counts.get(k, 0) + int(v)
    for k, v in me_counts.items():
        date_counts[k] = date_counts.get(k, 0) + int(v)
    return jsonify({'month': month, 'dateCounts': date_counts})

# -------- API: media --------

@app.get('/api/media/list')
@login_required
def api_media_list():
    day = request.args.get('date')
    if not day:
        return jsonify({'error': 'date required'}), 400
    entries = MediaEntry.query.filter_by(user_id=current_user.id, date=day).order_by(MediaEntry.id.desc()).all()
    return jsonify([{
        'id': e.id, 'date': e.date, 'checked': e.checked, 'text': e.text,
        'link': e.link, 'category': e.category, 'rating': e.rating,
        'tags': [t.name for t in e.tags]
    } for e in entries])

@app.post('/api/media/add')
@login_required
def api_media_add():
    data = request.json or {}
    day = data.get('date'); text = (data.get('text') or '').strip()
    link = (data.get('link') or '').strip() or None
    category = (data.get('category') or '').strip() or None
    checked = bool(data.get('checked', False))
    rating = data.get('rating'); tags_in = data.get('tags', [])
    if not day or not text:
        return jsonify({'error': 'date and text required'}), 400
    e = MediaEntry(user_id=current_user.id, date=day, checked=checked, text=text, link=link, category=category)
    if rating not in (None, ''):
        try: e.rating = int(rating)
        except Exception: e.rating = None
    tag_objs = get_or_create_tags(current_user.id, tags_in)
    for t in tag_objs: e.tags.append(t)
    db.session.add(e); db.session.commit()
    return jsonify({'ok': True, 'id': e.id})

@app.post('/api/media/update')
@login_required
def api_media_update():
    data = request.json or {}
    eid = data.get('id')
    e = MediaEntry.query.filter_by(id=eid, user_id=current_user.id).first_or_404()
    if 'checked' in data: e.checked = bool(data['checked'])
    if 'text' in data: e.text = (data['text'] or '').strip()
    if 'link' in data: e.link = (data['link'] or '').strip() or None
    if 'category' in data: e.category = (data['category'] or '').strip() or None
    if 'rating' in data:
        try: e.rating = int(data['rating']) if data['rating'] not in (None, '') else None
        except Exception: e.rating = None
    if 'tags' in data:
        tag_objs = get_or_create_tags(current_user.id, data.get('tags') or [])
        e.tags = tag_objs
    db.session.commit()
    return jsonify({'ok': True})

@app.post('/api/media/delete')
@login_required
def api_media_delete():
    data = request.json or {}
    eid = data.get('id')
    e = MediaEntry.query.filter_by(id=eid, user_id=current_user.id).first_or_404()
    db.session.delete(e); db.session.commit()
    return jsonify({'ok': True})

# -------- Numeric APIs --------
@app.post('/api/numeric/set')
@login_required
def api_numeric_set():
    data = request.json or {}
    hid = data.get('id'); day = data.get('date'); value = float(data.get('value') or 0)
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    if h.kind != 'numeric':
        return jsonify({'error': 'habit is not numeric'}), 400
    if h.allow_multi:
        ne = NumericEntry(habit_id=h.id, date=day, value=value)
        db.session.add(ne)
    else:
        rec = Record.query.filter_by(habit_id=h.id, date=day).first()
        if not rec:
            rec = Record(habit_id=h.id, date=day); db.session.add(rec)
        rec.value = value; rec.done = value > 0
    db.session.commit(); return jsonify({'ok': True})

@app.post('/api/numeric/clear')
@login_required
def api_numeric_clear():
    data = request.json or {}
    hid = data.get('id'); day = data.get('date')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    if h.kind != 'numeric':
        return jsonify({'error': 'habit is not numeric'}), 400
    if h.allow_multi:
        db.session.execute(text("DELETE FROM numeric_entry WHERE habit_id = :hid AND date = :d"), {'hid': h.id, 'd': day})
    else:
        rec = Record.query.filter_by(habit_id=h.id, date=day).first()
        if rec:
            rec.value = 0; rec.done = False
    db.session.commit(); return jsonify({'ok': True})

# -------- Habit APIs --------

@app.post('/api/habits/add')
@login_required
def api_add_habit():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    kind = data.get('kind') or 'checkbox'
    color = data.get('color') or '#6366f1'
    monthly_goal = data.get('monthlyGoal')
    try:
        monthly_goal = int(monthly_goal) if monthly_goal not in (None, '') else None
    except Exception:
        monthly_goal = None
    tags_in = data.get('tags', [])
    if not name:
        return jsonify({'error': 'name required'}), 400
    unit = (data.get('unit') or '').strip() or None
    aggregation = (data.get('aggregation') or 'sum').strip()
    daily_goal = data.get('dailyGoal')
    try:
        daily_goal = float(daily_goal) if daily_goal not in (None, '') else None
    except Exception:
        daily_goal = None
    allow_multi = bool(data.get('allowMulti', False))

    h = Habit(user_id=current_user.id, name=name, kind=kind, color=color, monthly_goal=monthly_goal,
              unit=unit if kind=='numeric' else None,
              aggregation=aggregation if kind=='numeric' else None,
              daily_goal=daily_goal if kind=='numeric' else None,
              allow_multi=allow_multi if kind=='numeric' else False)
    h.tags = get_or_create_tags(current_user.id, tags_in)
    db.session.add(h); db.session.commit()
    return jsonify({'ok': True, 'id': h.id})

@app.post('/api/habits/tags')
@login_required
def api_set_habit_tags():
    data = request.json or {}
    hid = data.get('id'); tags_in = data.get('tags', [])
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    h.tags = get_or_create_tags(current_user.id, tags_in)
    db.session.commit(); return jsonify({'ok': True})

@app.post('/api/habits/goal')
@login_required
def api_update_habit_goal():
    data = request.json or {}
    hid = data.get('id')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    val = data.get('monthlyGoal')
    try:
        h.monthly_goal = int(val) if val not in (None, '') else None
    except Exception:
        h.monthly_goal = None
    db.session.commit()
    return jsonify({'ok': True, 'monthlyGoal': h.monthly_goal})

@app.post('/api/habits/delete')
@login_required
def api_delete_habit():
    data = request.json or {}
    hid = data.get('id')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    db.session.delete(h); db.session.commit()
    return jsonify({'ok': True})


@app.get('/api/habit/values')
@login_required
def get_habit_values():
    habit_id = request.args.get('habit_id', type=int)
    date_str = request.args.get('date')
    if not habit_id or not date_str:
        return jsonify({'error': 'Missing parameters'}), 400
    record = Record.query.join(Habit).filter(
        Record.habit_id == habit_id,
        Record.date == date_str,
        Habit.user_id == current_user.id
    ).first()
    if not record:
        return jsonify({'value': None})
    if record.habit.kind == 'numeric':
        return jsonify({'value': record.value})
    elif record.habit.kind == 'metrics':
        return jsonify({'time_min': record.time_min, 'distance_km': record.distance_km})
    elif record.habit.kind == 'checkbox':
        return jsonify({'done': bool(record.done)})
    else:
        return jsonify({'value': None})


@app.post('/api/habit/delete-value')
@login_required
def delete_habit_value():
    data = request.get_json()
    habit_id = data.get('habit_id')
    date_str = data.get('date')
    if not habit_id or not date_str:
        return jsonify({'error': 'Missing parameters'}), 400
    record = Record.query.join(Habit).filter(
        Record.habit_id == habit_id,
        Record.date == date_str,
        Habit.user_id == current_user.id
    ).first()
    if record:
        db.session.delete(record)
        db.session.commit()
    return jsonify({'success': True})



@app.post('/api/toggle')
@login_required
def api_toggle():
    data = request.json or {}
    hid = data.get('id'); day = data.get('date')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    rec = Record.query.filter_by(habit_id=h.id, date=day).first()
    if not rec:
        rec = Record(habit_id=h.id, date=day, done=True); db.session.add(rec)
    else:
        rec.done = not rec.done
    db.session.commit(); return jsonify({'ok': True})

@app.post('/api/metrics')
@login_required
def api_metrics():
    data = request.json or {}
    hid = data.get('id'); day = data.get('date')
    metrics = data.get('metrics', {})
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    if h.kind != 'metrics':
        return jsonify({'error': 'habit is not metrics type'}), 400
    time_min = float(metrics.get('timeMin') or 0)
    distance_km = float(metrics.get('distanceKm') or 0)
    done = (time_min > 0) or (distance_km > 0)
    rec = Record.query.filter_by(habit_id=h.id, date=day).first()
    if not rec:
        rec = Record(habit_id=h.id, date=day); db.session.add(rec)
    rec.done = done; rec.time_min = time_min; rec.distance_km = distance_km
    db.session.commit(); return jsonify({'ok': True})

@app.post('/api/clear')
@login_required
def api_clear():
    data = request.json or {}
    hid = data.get('id'); day = data.get('date')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    rec = Record.query.filter_by(habit_id=h.id, date=day).first()
    if rec: db.session.delete(rec); db.session.commit()
    return jsonify({'ok': True})

# -------- Streak helper --------
def compute_streaks(records_dates_set):
    # records_dates_set: set of 'YYYY-MM-DD' strings for days with done=true (or >0 for numeric)
    # Returns current_streak (count up to today) and best_streak (historical max)
    if not records_dates_set:
        return 0, 0
    # Build continuous ranges
    from datetime import timedelta, date as _date
    dates = sorted(_date.fromisoformat(d) for d in records_dates_set)
    best = 0; cur = 0
    prev = None
    for d in dates:
        if prev is None or (d - prev).days > 1:
            cur = 1
        else:
            cur += 1
        best = max(best, cur)
        prev = d
    # current streak up to today
    today = _date.today()
    cur_today = 0
    i = len(dates)-1
    while i >= 0 and (today - dates[i]).days >= 0 and (today - dates[i]).days <= cur_today:
        cur_today += 1
        i -= 1
    return cur_today, best

def normalize_rows(rows):
    out = []
    for r in rows or []:
        if isinstance(r, dict):
            out.append(r)
            continue
        try:
            if hasattr(r, '_mapping'):
                out.append(dict(r._mapping))
            else:
                out.append(dict(r))
        except Exception:
            try:
                # Try to use keys()/__getitem__
                d = {k: (r[k] if isinstance(k, str) else getattr(r, k)) for k in getattr(r, 'keys', lambda: [])()}
                if d:
                    out.append(d); continue
            except Exception:
                pass
            out.append({'value': str(r)})
    return out

# -------- API: reports --------

@app.get('/api/reports')
@login_required
def api_reports():
    period = request.args.get('period', 'week')  # week|month|year
    start = request.args.get('start')  # YYYY-MM-DD optional
    sort_by = request.args.get('sort', 'date')   # date|habit|category|rating
    tag = request.args.get('tag')  # optional single tag filter

    today = date.today()
    if start:
        try:
            base = parse_date(start)
        except Exception:
            base = today
    else:
        base = today

    if period == 'year':
        start_date = date(base.year, 1, 1)
        end_date = date(base.year, 12, 31)
    elif period == 'month':
        start_date = date(base.year, base.month, 1)
        if base.month == 12:
            end_date = date(base.year, 12, 31)
        else:
            end_date = date(base.year, base.month + 1, 1) - timedelta(days=1)
    else:  # week: Monday..Sunday
        start_date = base - timedelta(days=(base.weekday()))  # Monday
        end_date = start_date + timedelta(days=6)

    s = start_date.strftime('%Y-%m-%d'); e = end_date.strftime('%Y-%m-%d')

    # Habits (apply tag filter at habit level)
    habits = Habit.query.filter_by(user_id=current_user.id, active=True).all()
    if tag:
        habits = [h for h in habits if any(t.name.lower()==tag.lower() for t in h.tags)]
    habit_rows = []
    for h in habits:
        for r in h.records:
            if s <= r.date <= e:
                row = {
                    'type': 'habit',
                    'date': r.date,
                    'habit': h.name,
                    'kind': h.kind,
                    'done': bool(r.done),
                    'timeMin': r.time_min or 0,
                    'distanceKm': r.distance_km or 0,
                    'tags': [t.name for t in h.tags]
                }
                habit_rows.append(row)

    # Media entries (apply tag filter at entry level)
    me_query = MediaEntry.query.filter(
        MediaEntry.user_id == current_user.id,
        MediaEntry.date >= s, MediaEntry.date <= e
    )
    media_rows = []
    for eobj in me_query.all():
        if tag and all(t.name.lower()!=tag.lower() for t in eobj.tags):
            continue
        media_rows.append({
            'type': 'journal',
            'date': eobj.date,
            'category': eobj.category or '',
            'text': eobj.text,
            'link': eobj.link,
            'checked': bool(eobj.checked),
            'rating': eobj.rating,
            'tags': [t.name for t in eobj.tags]
        })

    rows = habit_rows + media_rows

    def sort_key(row):
        if sort_by == 'habit':
            return (row.get('habit','').lower(), row.get('date',''))
        if sort_by == 'category':
            return (row.get('category','').lower(), row.get('date',''))
        if sort_by == 'rating':
            val = row.get('rating')
            return (1, 0) if val is None else (0, -val)  # unrated last, highest first
        return (row.get('date',''), row.get('habit','').lower())

    # Monthly goals progress for month containing 'base'
    month_start = date(base.year, base.month, 1)
    if base.month == 12:
        month_end = date(base.year, 12, 31)
    else:
        month_end = date(base.year, base.month + 1, 1) - timedelta(days=1)
    ms, me = month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d')

    goals = []
    for h in Habit.query.filter_by(user_id=current_user.id, active=True).all():
        if h.monthly_goal is None or h.monthly_goal <= 0:
            continue
        cnt = sum(1 for r in h.records if ms <= r.date <= me and r.done)
        pct = (cnt / h.monthly_goal) * 100 if h.monthly_goal else 0
        goals.append({
            'habitId': h.id,
            'habit': h.name,
            'monthlyGoal': h.monthly_goal,
            'active': bool(h.active),
            'doneCount': cnt,
            'percent': round(pct, 2)
        })

    rows.sort(key=sort_key)
    
    # Period totals (by habit) and streaks
    period_totals = []
    # Build map for quick day checks per habit for streaks
    from collections import defaultdict
    habit_done_dates = defaultdict(set)
    # Collect done dates across all time for streaks
    for h in Habit.query.filter_by(user_id=current_user.id, active=True).all():
        if h.kind == 'checkbox':
            for r in h.records:
                if r.done:
                    habit_done_dates[h.id].add(r.date)
        elif h.kind == 'metrics':
            for r in h.records:
                if r.done:
                    habit_done_dates[h.id].add(r.date)
        elif h.kind == 'numeric':
            # non-multi: consider value>0
            for r in h.records:
                if (r.value or 0) > 0:
                    habit_done_dates[h.id].add(r.date)
            # multi: any numeric entries on a day → done
            rows = db.session.execute(text("SELECT date, SUM(value) as total FROM numeric_entry WHERE habit_id = :hid GROUP BY date"), {'hid': h.id}).mappings().all()
            for row in rows:
                if (row['total'] or 0) > 0:
                    habit_done_dates[h.id].add(row['date'])

    # For the selected period, compute totals by habit
    totals_map = defaultdict(lambda: {'habit': '', 'kind': '', 'color': '#6366f1', 'unit': None, 'count': 0, 'sum': 0.0})
    for h in Habit.query.filter_by(user_id=current_user.id, active=True).all():
        key = h.id
        totals_map[key]['habit'] = h.name
        totals_map[key]['kind'] = h.kind
        totals_map[key]['color'] = h.color
        totals_map[key]['unit'] = h.unit
        # count of days done in [s,e]
        if h.kind in ('checkbox','metrics','numeric'):
            # For numeric, 'done' means value>0 (or any entries)
            # Use rows and records to compute both count and sum in period
            # Boolean count:
            dates_in_range = [d for d in habit_done_dates[h.id] if s <= d <= e]
            totals_map[key]['count'] = len(dates_in_range)
            # Sum for numeric only
            if h.kind == 'numeric':
                # non-multi record values in range
                sum_val = 0.0
                for r in h.records:
                    if s <= r.date <= e:
                        sum_val += float(r.value or 0)
                # add multi entries
                rows = db.session.execute(text("SELECT SUM(value) as total FROM numeric_entry WHERE habit_id = :hid AND date >= :s AND date <= :e"),
                                          {'hid': h.id, 's': s, 'e': e}).mappings().first()
                sum_val += float(rows['total'] or 0)
                totals_map[key]['sum'] = round(sum_val, 2)

    for key, v in totals_map.items():
        cur, best = compute_streaks(habit_done_dates[key])
        v['currentStreak'] = cur
        v['bestStreak'] = best
        period_totals.append(v)
    return jsonify({
            'start': s, 'end': e, 'period': period,
            'count': len(rows),
            'rows': normalize_rows(rows),
            'summary': period_totals,
            'goalsMonth': month_start.strftime('%Y-%m'),
            'goals': goals
        })



class NumericEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False, index=True)
    date = db.Column(db.String(10), nullable=False, index=True)
    value = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


@app.post('/api/habits/active')
@login_required
def api_habit_active():
    data = request.json or {}
    hid = data.get('id')
    on = bool(data.get('active', True))
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    h.active = on
    db.session.commit()
    return jsonify({'ok': True, 'active': h.active})


# -------- Export CSV --------
from flask import Response
import csv
from io import StringIO

@app.get('/export/csv')
@login_required
def export_csv():
    # Reuse the same parameters as reports
    period = request.args.get('period', 'week')
    start = request.args.get('start')
    tag = request.args.get('tag')
    today = date.today()

    def _parse_date(s: str):
        y, m, d = [int(x) for x in s.split('-')]
        return date(y, m, d)

    if start:
        try:
            base_d = _parse_date(start)
        except Exception:
            base_d = today
    else:
        base_d = today

    if period == 'month':
        s = date(base_d.year, base_d.month, 1).strftime('%Y-%m-%d')
        if base_d.month == 12:
            e = date(base_d.year, 12, 31).strftime('%Y-%m-%d')
        else:
            e = (date(base_d.year, base_d.month + 1, 1) - timedelta(days=1)).strftime('%Y-%m-%d')
    elif period == 'year':
        s = date(base_d.year, 1, 1).strftime('%Y-%m-%d')
        e = date(base_d.year, 12, 31).strftime('%Y-%m-%d')
    else:
        # week (Mon..Sun around base)
        base_monday = base_d - timedelta(days=base_d.weekday())
        s = base_monday.strftime('%Y-%m-%d')
        e = (base_monday + timedelta(days=6)).strftime('%Y-%m-%d')

    rows = []

    # Habits (active only)
    habits = Habit.query.filter_by(user_id=current_user.id, active=True).all()
    if tag:
        habits = [h for h in habits if any(t.name.lower() == tag.lower() for t in h.tags)]
    for h in habits:
        # checkbox + metrics + numeric (non-multi via Record)
        for r in h.records:
            if s <= r.date <= e:
                if h.kind == 'checkbox' and not r.done:
                    continue
                row = {
                    'type': 'habit',
                    'date': r.date,
                    'habit': h.name,
                    'kind': h.kind,
                    'done': bool(r.done),
                    'timeMin': r.time_min or 0,
                    'distanceKm': r.distance_km or 0,
                    'value': r.value or 0,
                    'unit': h.unit or '',
                    'text': '',
                    'link': '',
                    'tags': ','.join(sorted(t.name for t in h.tags))
                }
                if h.kind == 'numeric' and not h.allow_multi and (row['value'] or 0) <= 0:
                    continue
                rows.append(row)
        # numeric multi: aggregate from numeric_entry
        if h.kind == 'numeric' and h.allow_multi:
            sql = ("SELECT date, SUM(value) as total FROM numeric_entry "
                   "WHERE habit_id = :hid AND date >= :s AND date <= :e GROUP BY date")
            res = db.session.execute(text(sql), {'hid': h.id, 's': s, 'e': e}).mappings().all()
            for rr in res:
                if (rr['total'] or 0) > 0:
                    rows.append({
                        'type': 'habit',
                        'date': rr['date'],
                        'habit': h.name,
                        'kind': h.kind,
                        'done': True,
                        'timeMin': 0,
                        'distanceKm': 0,
                        'value': float(rr['total'] or 0),
                        'unit': h.unit or '',
                        'text': '',
                        'link': '',
                        'tags': ','.join(sorted(t.name for t in h.tags))
                    })

    # Media entries
    me_query = MediaEntry.query.filter(
        MediaEntry.user_id == current_user.id,
        MediaEntry.date >= s, MediaEntry.date <= e
    )
    if tag:
        me_query = me_query.join(MediaEntry.tags).filter(Tag.name == tag)
    for me in me_query.all():
        rows.append({
            'type': 'journal',
            'date': me.date,
            'habit': '',
            'kind': me.category or '',
            'done': bool(me.checked),
            'timeMin': 0,
            'distanceKm': 0,
            'value': me.rating if me.rating is not None else '',
            'unit': 'rating',
            'text': me.text,
            'link': me.link or '',
            'tags': ','.join(sorted(t.name for t in me.tags))
        })

    # Prepare CSV
    cols = ['type','date','habit','kind','done','timeMin','distanceKm','value','unit','text','link','tags']
    out = StringIO()
    writer = csv.DictWriter(out, fieldnames=cols, extrasaction='ignore')
    writer.writeheader()
    for r in sorted(rows, key=lambda x: (x['date'], x.get('type',''))):
        writer.writerow(r)
    csv_bytes = out.getvalue()
    filename = f"habit_export_{s}_to_{e}.csv"
    return Response(csv_bytes, mimetype='text/csv', headers={'Content-Disposition': f'attachment; filename={filename}'})


@app.route('/habits', methods=['GET'])
@login_required
def habits_page():
    return render_template('habits.html')


# ------------- Startup -------------

if __name__ == '__main__':
    init_db()
    app.run(debug=True)

