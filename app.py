
from __future__ import annotations
from flask import Flask, render_template, request, redirect, url_for, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime, timedelta
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
    kind = db.Column(db.String(50), nullable=False, default='checkbox')
    color = db.Column(db.String(20), nullable=False, default='#6366f1')
    records = db.relationship('Record', backref='habit', lazy=True, cascade='all, delete-orphan')
    tags = db.relationship('Tag', secondary='habit_tag', back_populates='habits')

class Record(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False, index=True)
    date = db.Column(db.String(10), nullable=False, index=True)  # YYYY-MM-DD
    done = db.Column(db.Boolean, default=False, nullable=False)
    time_min = db.Column(db.Float, nullable=True)
    distance_km = db.Column(db.Float, nullable=True)
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
    habits = Habit.query.filter_by(user_id=current_user.id).all()
    payload = []
    for h in habits:
        rec_map = {}
        for r in h.records:
            if h.kind == 'checkbox':
                rec_map[r.date] = bool(r.done)
            else:
                rec_map[r.date] = {'done': bool(r.done), 'metrics': {'timeMin': r.time_min or 0, 'distanceKm': r.distance_km or 0}}
        payload.append({
            'id': h.id, 'name': h.name, 'kind': h.kind, 'color': h.color,
            'tags': [t.name for t in h.tags],
            'records': rec_map
        })
    return jsonify({'today': date.today().isoformat(), 'habits': payload})

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

# -------- Habit APIs --------

@app.post('/api/habits/add')
@login_required
def api_add_habit():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    kind = data.get('kind') or 'checkbox'
    color = data.get('color') or '#6366f1'
    tags_in = data.get('tags', [])
    if not name:
        return jsonify({'error': 'name required'}), 400
    h = Habit(user_id=current_user.id, name=name, kind=kind, color=color)
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

@app.post('/api/habits/delete')
@login_required
def api_delete_habit():
    data = request.json or {}
    hid = data.get('id')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    db.session.delete(h); db.session.commit()
    return jsonify({'ok': True})

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

    # Habits: join with tags filter (habit-level tags)
    habits = Habit.query.filter_by(user_id=current_user.id).all()
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

    # Media entries: filter by date and tag (entry-level tags)
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
            # None ratings last
            val = row.get('rating')
            return (1, 0) if val is None else (0, -val)
        return (row.get('date',''), row.get('habit','').lower())

    rows.sort(key=sort_key)
    return jsonify({
        'start': s, 'end': e, 'period': period,
        'count': len(rows),
        'rows': rows
    })

# ------------- Startup -------------

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
