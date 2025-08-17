from __future__ import annotations
from flask import Flask, render_template, request, redirect, url_for, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    habits = db.relationship('Habit', backref='user', lazy=True, cascade='all, delete-orphan')

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

class Record(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False, index=True)
    date = db.Column(db.String(10), nullable=False, index=True)  # YYYY-MM-DD
    done = db.Column(db.Boolean, default=False, nullable=False)
    time_min = db.Column(db.Float, nullable=True)
    distance_km = db.Column(db.Float, nullable=True)
    __table_args__ = (db.UniqueConstraint('habit_id', 'date', name='uniq_habit_date'), )

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

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
        user = User(email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
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
            login_user(user)
            return redirect(url_for('index'))
        flash('Invalid email or password', 'error')
        return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

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
        payload.append({'id': h.id, 'name': h.name, 'kind': h.kind, 'color': h.color, 'records': rec_map})
    return jsonify({'today': date.today().isoformat(), 'habits': payload})

@app.post('/api/habits/add')
@login_required
def api_add_habit():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    kind = data.get('kind') or 'checkbox'
    color = data.get('color') or '#6366f1'
    if not name:
        return jsonify({'error': 'name required'}), 400
    h = Habit(user_id=current_user.id, name=name, kind=kind, color=color)
    db.session.add(h)
    db.session.commit()
    return jsonify({'ok': True, 'id': h.id})

@app.post('/api/habits/delete')
@login_required
def api_delete_habit():
    data = request.json or {}
    hid = data.get('id')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    db.session.delete(h)
    db.session.commit()
    return jsonify({'ok': True})

@app.post('/api/toggle')
@login_required
def api_toggle():
    data = request.json or {}
    hid = data.get('id')
    day = data.get('date')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    rec = Record.query.filter_by(habit_id=h.id, date=day).first()
    if not rec:
        rec = Record(habit_id=h.id, date=day, done=True)
        db.session.add(rec)
    else:
        rec.done = not rec.done
    db.session.commit()
    return jsonify({'ok': True})

@app.post('/api/metrics')
@login_required
def api_metrics():
    data = request.json or {}
    hid = data.get('id')
    day = data.get('date')
    metrics = data.get('metrics', {})
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    if h.kind != 'metrics':
        return jsonify({'error': 'habit is not metrics type'}), 400
    time_min = float(metrics.get('timeMin') or 0)
    distance_km = float(metrics.get('distanceKm') or 0)
    done = (time_min > 0) or (distance_km > 0)
    rec = Record.query.filter_by(habit_id=h.id, date=day).first()
    if not rec:
        rec = Record(habit_id=h.id, date=day)
        db.session.add(rec)
    rec.done = done
    rec.time_min = time_min
    rec.distance_km = distance_km
    db.session.commit()
    return jsonify({'ok': True})

@app.post('/api/clear')
@login_required
def api_clear():
    data = request.json or {}
    hid = data.get('id')
    day = data.get('date')
    h = Habit.query.filter_by(id=hid, user_id=current_user.id).first_or_404()
    rec = Record.query.filter_by(habit_id=h.id, date=day).first()
    if rec:
        db.session.delete(rec)
        db.session.commit()
    return jsonify({'ok': True})

def init_db():
    with app.app_context():
        db.create_all()

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
