"""
Pytest configuration and shared fixtures.

env vars and sys.path must be set before any backend module is imported,
so this file does that work at module level — conftest.py is always loaded
by pytest before the test files that use it.
"""
import os
import sys
import tempfile

import pytest

# Point at a temp SQLite file so db.create_all() in app.py never touches
# the real psych_app.db file.
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_db_path}")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("MODEL_PROVIDER", "local")

# Add backend/ to sys.path so bare imports (import config, import chat_manager)
# work the same way they do when app.py is run from inside backend/.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import app as flask_app  # noqa: E402


@pytest.fixture(scope="session")
def app():
    """Flask app configured for testing, shared across the whole test session."""
    flask_app.config["TESTING"] = True
    yield flask_app
    # Release SQLAlchemy's connection pool before deleting the file.
    # Without this, Windows raises PermissionError (file still in use).
    from models import db
    with flask_app.app_context():
        db.engine.dispose()
    os.close(_db_fd)
    os.unlink(_db_path)


@pytest.fixture
def client(app):
    """A fresh test client for each test function."""
    with app.test_client() as c:
        yield c
