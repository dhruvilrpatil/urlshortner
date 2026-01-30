# URL Shortener

Project URL: https://dhruvilrpatil.github.io/urlshortner/

## Quick start

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python backend\app.py
```

Open `http://localhost:5000`.

## Security limits

- Rate limits are tracked per IP and persisted in SQLite.
- Duplicate submissions of the same URL are throttled within a short window.

## Configuration

- `BASE_URL` (optional): set the public base URL used to build short links.
