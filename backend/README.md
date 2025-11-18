# Backend (Django + DRF)

## Quickstart

1) Create venv and install deps
```
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
```

2) Run migrations and create superuser
```
python manage.py migrate
python manage.py createsuperuser
```

3) Start server
```
python manage.py runserver 0.0.0.0:8000
```

## API
- Auth: POST /api/auth/token/ { username, password }
- Users: GET /api/users/profiles/me/
- Register: POST /api/users/register/register/ { username, email, password }
- Notices: CRUD at /api/notices/

Set `DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS` for production.

## Using MySQL
1) Install MySQL server and create a database (e.g. `noticeboard`).
2) Install deps (PyMySQL is already included):
```
pip install -r requirements.txt
```
3) Set environment variables before running:
```
set DB_ENGINE=django.db.backends.mysql
set DB_NAME=noticeboard
set DB_USER=root
set DB_PASSWORD=yourpassword
set DB_HOST=198.168.0.18
set DB_PORT=3306
```
On PowerShell, use `$env:DB_ENGINE="django.db.backends.mysql"` etc.
4) Migrate:
```
python manage.py migrate
```

