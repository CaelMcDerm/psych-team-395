import os
from flask import Flask, send_from_directory
from flask_cors import CORS

from routes.topics import topics_bp
from routes.chat import chat_bp

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

app.register_blueprint(topics_bp)
app.register_blueprint(chat_bp)


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, port=port)
