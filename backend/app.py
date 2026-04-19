import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_login import LoginManager

from models import db, User
from routes.groups import groups_bp
from routes.chat import chat_bp
from routes.auth import auth_bp

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app, supports_credentials=True)

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///psych_app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True

db.init_app(app)

login_manager = LoginManager(app)


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Authentication required"}), 401


app.register_blueprint(groups_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(auth_bp)

with app.app_context():
    db.create_all()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, port=port)
