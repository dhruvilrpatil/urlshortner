import os
from backend.app import create_app

# Expose the Flask WSGI application as the module-level variable `app`.
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
