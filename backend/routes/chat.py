import json
import uuid
import requests
from datetime import datetime
from flask import Blueprint, jsonify, request, session
from flask_login import current_user

import chat_manager
import config
from models import db, TransferProgress

chat_bp = Blueprint("chat", __name__)

TRANSFER_MARKER = "[TRANSFER_PASSED]"


def _mark_transfer_passed(user_id: int, group_id: str, topic_id: str) -> None:
    record = TransferProgress.query.filter_by(
        user_id=user_id, group_id=group_id, topic_id=topic_id
    ).first()
    if not record:
        record = TransferProgress(
            user_id=user_id,
            group_id=group_id,
            topic_id=topic_id,
            passed=True,
            passed_at=datetime.utcnow(),
        )
        db.session.add(record)
    elif not record.passed:
        record.passed = True
        record.passed_at = datetime.utcnow()
    db.session.commit()


def _get_ids():
    """Return (user_id, guest_id) based on current auth state."""
    if current_user.is_authenticated:
        return current_user.id, None
    if "guest_id" not in session:
        session["guest_id"] = str(uuid.uuid4())
    return None, session["guest_id"]


def call_cloud_api(history: list[dict], system_prompt: str) -> str:
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    headers = {
        "x-api-key": config.CLOUD_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": config.CLOUD_MODEL,
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": messages,
    }
    resp = requests.post(config.CLOUD_API_URL, json=body, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["content"][0]["text"]


def call_local_api(history: list[dict], system_prompt: str) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": m["role"], "content": m["content"]} for m in history]
    body = {
        "model": config.LOCAL_MODEL,
        "messages": messages,
        "stream": True,
        "think": False,
        "options": {
            "num_ctx": config.LOCAL_NUM_CTX,
            "num_predict": config.LOCAL_NUM_PREDICT,
            "temperature": 0.7,
        },
    }
    # Use streaming so individual chunk reads won't time out even on
    # slow hardware.  The connect timeout is short; the *read* timeout
    # is generous to allow for the initial model-load / prompt-eval.
    resp = requests.post(
        config.LOCAL_API_URL,
        json=body,
        timeout=(10, 300),   # (connect, read) — per-chunk read timeout
        stream=True,
    )
    resp.raise_for_status()

    chunks: list[str] = []
    for line in resp.iter_lines():
        if not line:
            continue
        data = json.loads(line)
        token = data.get("message", {}).get("content", "")
        if token:
            chunks.append(token)
        if data.get("done"):
            break
    return "".join(chunks)


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    payload = request.get_json()
    group_id = payload.get("groupId")
    topic_id = payload.get("topicId")
    message = payload.get("message", "").strip()
    response_mode = payload.get("responseMode", "detailed")
    if response_mode not in ("concise", "detailed"):
        response_mode = "detailed"

    if not all([group_id, topic_id, message]):
        return jsonify({"error": "groupId, topicId, and message are required"}), 400

    user_id, guest_id = _get_ids()
    chat_manager.append(user_id, group_id, topic_id, "user", message, guest_id)
    history = chat_manager.get_history(user_id, group_id, topic_id, guest_id)
    system_prompt = config.get_system_prompt(group_id, topic_id, response_mode)

    try:
        if config.MODEL_PROVIDER == "cloud":
            reply = call_cloud_api(history, system_prompt)
        else:
            reply = call_local_api(history, system_prompt)
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Could not reach the AI service. If you are running locally, make sure Ollama is running."}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "The AI service took too long to respond. Please try again."}), 504
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            return jsonify({"error": "The AI service is rate-limited. Please wait a moment and try again."}), 429
        return jsonify({"error": "The AI service returned an unexpected error. Please try again."}), 502
    except Exception:
        return jsonify({"error": "An unexpected error occurred. Please try again."}), 502

    transfer_passed = TRANSFER_MARKER in reply
    if transfer_passed:
        reply = reply.replace(TRANSFER_MARKER, "").rstrip()
        if user_id is not None:
            _mark_transfer_passed(user_id, group_id, topic_id)

    chat_manager.append(user_id, group_id, topic_id, "assistant", reply, guest_id)
    return jsonify({"reply": reply, "transfer_passed": transfer_passed and user_id is not None})


@chat_bp.route("/api/chat/reset", methods=["POST"])
def chat_reset():
    payload = request.get_json()
    group_id = payload.get("groupId")
    topic_id = payload.get("topicId")
    if not all([group_id, topic_id]):
        return jsonify({"error": "groupId and topicId are required"}), 400
    user_id, guest_id = _get_ids()
    chat_manager.reset(user_id, group_id, topic_id, guest_id)
    return jsonify({"ok": True})


@chat_bp.route("/api/chat/history", methods=["GET"])
def chat_history():
    group_id = request.args.get("groupId")
    topic_id = request.args.get("topicId")
    if not all([group_id, topic_id]):
        return jsonify({"error": "groupId and topicId are required"}), 400
    user_id, guest_id = _get_ids()
    history = chat_manager.get_history(user_id, group_id, topic_id, guest_id)
    return jsonify({"history": history})
