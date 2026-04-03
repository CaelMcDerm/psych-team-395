from flask import Blueprint, jsonify
from config import TOPICS

topics_bp = Blueprint("topics", __name__)


@topics_bp.route("/api/topics", methods=["GET"])
def get_topics():
    public = [
        {"id": t["id"], "label": t["label"], "description": t["description"]}
        for t in TOPICS
    ]
    return jsonify(public)
