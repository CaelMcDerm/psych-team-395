from flask import Blueprint, jsonify
from config import SPECIES_GROUPS

groups_bp = Blueprint("groups", __name__)


@groups_bp.route("/api/groups", methods=["GET"])
def get_groups():
    return jsonify(SPECIES_GROUPS)
