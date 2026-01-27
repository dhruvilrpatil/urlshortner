from __future__ import annotations

import os
import sqlite3
import secrets
import time
from datetime import datetime, timedelta
from functools import wraps
from urllib.parse import urlparse

from flask import Flask, jsonify, redirect, render_template, request, g, current_app

BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
CODE_LENGTH = 7
MAX_URL_LENGTH = 2048
EXPIRATION_HOURS = 24  # URLs expire after 24 hours
RATE_LIMITS = {
    "shorten": {"limit": 10, "window": 60},
    "follow": {"limit": 120, "window": 60},
}
SPAM_WINDOW_SECONDS = 30
SPAM_MAX_DUPLICATES = 3


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, 
               static_folder=os.path.join(os.path.dirname(__file__), "static"),
               static_url_path="/static",
               template_folder=os.path.join(os.path.dirname(__file__), "templates"))

    app.config.from_mapping(
        DATABASE=os.path.join(os.path.dirname(__file__), "..", "instance", "urlshortener.sqlite3"),
        BASE_URL=os.environ.get("BASE_URL", ""),
        JSONIFY_PRETTYPRINT_REGULAR=False,
    )

    if test_config:
        app.config.update(test_config)

    os.makedirs(app.instance_path, exist_ok=True)

    with app.app_context():
        init_db()

    @app.route("/")
    def index() -> str:
        return render_template("index.html")

    @app.post("/shorten")
    @rate_limit("shorten")
    def shorten():
        payload = request.get_json(silent=True) or {}
        original_url = (payload.get("url") or "").strip()
        custom_code = (payload.get("code") or "").strip()
        
        error = validate_url(original_url)
        if error:
            return jsonify({"error": error}), 400

        # Validate custom code if provided
        if custom_code:
            code_error = validate_custom_code(custom_code)
            if code_error:
                return jsonify({"error": code_error}), 400

        db = get_db()
        if is_spam_submission(db, get_client_ip(), original_url):
            return jsonify({"error": "Too many repeated submissions. Try again later."}), 429

        existing = db.execute(
            "SELECT code, original_url FROM urls WHERE original_url = ?",
            (original_url,),
        ).fetchone()
        if existing:
            return (
                jsonify(
                    {
                        "code": existing["code"],
                        "original_url": existing["original_url"],
                        "short_url": build_short_url(existing["code"]),
                        "message": "This URL was already shortened.",
                    }
                ),
                200,
            )

        created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        expires_at = (datetime.utcnow() + timedelta(hours=EXPIRATION_HOURS)).isoformat(timespec="seconds") + "Z"
        
        # If custom code is provided, try to use it
        if custom_code:
            code = insert_custom_url(db, custom_code, original_url, created_at, expires_at)
            if code is None:
                return jsonify({"error": "This short code is already taken. Please choose another one."}), 409
        else:
            code = insert_unique_url(db, original_url, created_at, expires_at)
            if not code:
                return jsonify({"error": "Unable to generate a unique short code."}), 409

        return (
            jsonify(
                {
                    "code": code,
                    "original_url": original_url,
                    "short_url": build_short_url(code),
                    "expires_at": expires_at,
                }
            ),
            201,
        )

    @app.get("/<code>")
    @rate_limit("follow")
    def follow(code: str):
        if not code or len(code) > 32:
            return render_template("not_found.html", code=code), 404

        db = get_db()
        row = db.execute(
            "SELECT id, original_url, expires_at FROM urls WHERE code = ?",
            (code,),
        ).fetchone()
        if not row:
            return render_template("not_found.html", code=code), 404

        # Check if URL has expired
        expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        if datetime.utcnow().replace(tzinfo=None) > expires_at.replace(tzinfo=None):
            # URL has expired, delete it
            db.execute("DELETE FROM urls WHERE id = ?", (row["id"],))
            db.commit()
            return render_template("not_found.html", code=code), 404

        db.execute(
            "UPDATE urls SET click_count = click_count + 1 WHERE id = ?",
            (row["id"],),
        )
        db.commit()
        return redirect(row["original_url"], code=302)

    @app.errorhandler(404)
    def not_found(_error):
        return render_template("not_found.html", code=""), 404

    @app.teardown_appcontext
    def close_db(_exception):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    return app


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(app_database_path(), detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
    return g.db


def app_database_path() -> str:
    return current_app.config["DATABASE"]


def init_db() -> None:
    db = sqlite3.connect(app_database_path())
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as file:
        db.executescript(file.read())
    db.close()


def validate_url(url: str) -> str | None:
    if not url:
        return "Please enter a URL."
    if len(url) > MAX_URL_LENGTH:
        return "URL is too long."

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return "URL must start with http:// or https://."
    if not parsed.netloc:
        return "URL must include a valid domain."
    return None


def validate_custom_code(code: str) -> str | None:
    """Validate custom short code."""
    if not code:
        return None
    
    if len(code) < 3:
        return "Short code must be at least 3 characters."
    
    if len(code) > 32:
        return "Short code must be at most 32 characters."
    
    # Only allow alphanumeric, hyphens, and underscores
    if not all(c.isalnum() or c in "-_" for c in code):
        return "Short code can only contain letters, numbers, hyphens, and underscores."
    
    return None


def base62_encode(value: int, min_length: int) -> str:
    if value == 0:
        encoded = "0"
    else:
        chars = []
        while value > 0:
            value, rem = divmod(value, 62)
            chars.append(BASE62_ALPHABET[rem])
        encoded = "".join(reversed(chars))

    if len(encoded) < min_length:
        encoded = "0" * (min_length - len(encoded)) + encoded
    return encoded


def generate_code() -> str:
    max_value = 62 ** CODE_LENGTH
    return base62_encode(secrets.randbelow(max_value), CODE_LENGTH)


def insert_unique_url(db: sqlite3.Connection, original_url: str, created_at: str, expires_at: str) -> str | None:
    for _ in range(10):
        code = generate_code()
        exists = db.execute("SELECT 1 FROM urls WHERE code = ?", (code,)).fetchone()
        if exists:
            continue
        try:
            db.execute(
                "INSERT INTO urls (code, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (code, original_url, created_at, expires_at),
            )
            db.commit()
            return code
        except sqlite3.IntegrityError:
            continue
    return None


def insert_custom_url(db: sqlite3.Connection, code: str, original_url: str, created_at: str, expires_at: str) -> str | None:
    """Insert URL with a custom short code. Returns the code if successful, None if code is taken."""
    # Check if code already exists
    exists = db.execute("SELECT 1 FROM urls WHERE code = ?", (code,)).fetchone()
    if exists:
        return None
    
    try:
        db.execute(
            "INSERT INTO urls (code, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (code, original_url, created_at, expires_at),
        )
        db.commit()
        return code
    except sqlite3.IntegrityError:
        return None


def build_short_url(code: str) -> str:
    base_url = (current_app.config.get("BASE_URL") or request.host_url).rstrip("/")
    return f"{base_url}/{code}"


def get_client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def rate_limit(bucket: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            config = RATE_LIMITS.get(bucket)
            if not config:
                return func(*args, **kwargs)
            db = get_db()
            ip = get_client_ip()
            allowed = check_rate_limit(db, ip, bucket, int(config["window"]), int(config["limit"]))
            if not allowed:
                return jsonify({"error": "Rate limit exceeded. Try again later."}), 429
            return func(*args, **kwargs)

        return wrapper

    return decorator


def check_rate_limit(
    db: sqlite3.Connection,
    ip: str,
    bucket: str,
    window_seconds: int,
    limit: int,
) -> bool:
    now = int(time.time())
    row = db.execute(
        "SELECT window_start, count FROM rate_limits WHERE ip = ? AND bucket = ?",
        (ip, bucket),
    ).fetchone()

    if row is None or now - row["window_start"] >= window_seconds:
        window_start = now
        count = 1
        db.execute(
            """
            INSERT INTO rate_limits (ip, bucket, window_start, count)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(ip, bucket) DO UPDATE SET window_start = ?, count = ?
            """,
            (ip, bucket, window_start, count, window_start, count),
        )
    else:
        count = row["count"] + 1
        db.execute(
            "UPDATE rate_limits SET count = ? WHERE ip = ? AND bucket = ?",
            (count, ip, bucket),
        )
    db.commit()
    return count <= limit


def is_spam_submission(db: sqlite3.Connection, ip: str, original_url: str) -> bool:
    now = int(time.time())
    row = db.execute(
        "SELECT window_start, count FROM spam_submissions WHERE ip = ? AND original_url = ?",
        (ip, original_url),
    ).fetchone()

    if row is None or now - row["window_start"] >= SPAM_WINDOW_SECONDS:
        window_start = now
        count = 1
        db.execute(
            """
            INSERT INTO spam_submissions (ip, original_url, window_start, count)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(ip, original_url) DO UPDATE SET window_start = ?, count = ?
            """,
            (ip, original_url, window_start, count, window_start, count),
        )
    else:
        count = row["count"] + 1
        db.execute(
            "UPDATE spam_submissions SET count = ? WHERE ip = ? AND original_url = ?",
            (count, ip, original_url),
        )
    db.commit()
    return count > SPAM_MAX_DUPLICATES


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
