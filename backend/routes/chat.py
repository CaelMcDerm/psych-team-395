import requests
from flask import Blueprint, jsonify, request

import chat_manager
import config

chat_bp = Blueprint("chat", __name__)


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
        "stream": False,
    }
    resp = requests.post(config.LOCAL_API_URL, json=body, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data["message"]["content"]


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    payload = request.get_json()
    topic_id = payload.get("topicId")
    message = payload.get("message", "").strip()

    if not topic_id or not message:
        return jsonify({"error": "topicId and message are required"}), 400

    chat_manager.append(topic_id, "user", message)
    history = chat_manager.get_history(topic_id)
    system_prompt = chat_manager.get_system_prompt(topic_id)

    try:
        if config.MODEL_PROVIDER == "cloud":
            reply = call_cloud_api(history, system_prompt)
        else:
            reply = call_local_api(history, system_prompt)
    except Exception as e:
        return jsonify({"error": str(e)}), 502

    chat_manager.append(topic_id, "assistant", reply)
    return jsonify({"reply": reply})


@chat_bp.route("/api/chat/reset", methods=["POST"])
def chat_reset():
    payload = request.get_json()
    topic_id = payload.get("topicId")
    if not topic_id:
        return jsonify({"error": "topicId is required"}), 400
    chat_manager.reset(topic_id)
    return jsonify({"ok": True})
