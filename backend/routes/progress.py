from flask import Blueprint, jsonify
from flask_login import current_user, login_required

from models import TransferProgress

progress_bp = Blueprint("progress", __name__)


@progress_bp.route("/api/progress", methods=["GET"])
@login_required
def get_progress():
    records = TransferProgress.query.filter_by(
        user_id=current_user.id, passed=True
    ).all()
    return jsonify({
        "progress": [
            {
                "group_id": r.group_id,
                "topic_id": r.topic_id,
                "passed_at": r.passed_at.isoformat() if r.passed_at else None,
            }
            for r in records
        ]
    })
