import json
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
        "stream": True,
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

    if not all([group_id, topic_id, message]):
        return jsonify({"error": "groupId, topicId, and message are required"}), 400

    chat_manager.append(group_id, topic_id, "user", message)
    history = chat_manager.get_history(group_id, topic_id)
    system_prompt = chat_manager.get_system_prompt(group_id, topic_id)

    try:
        if config.MODEL_PROVIDER == "cloud":
            reply = call_cloud_api(history, system_prompt)
        else:
            reply = call_local_api(history, system_prompt)
    except Exception as e:
        return jsonify({"error": str(e)}), 502

    chat_manager.append(group_id, topic_id, "assistant", reply)
    return jsonify({"reply": reply})


@chat_bp.route("/api/chat/reset", methods=["POST"])
def chat_reset():
    payload = request.get_json()
    group_id = payload.get("groupId")
    topic_id = payload.get("topicId")
    if not all([group_id, topic_id]):
        return jsonify({"error": "groupId and topicId are required"}), 400
    chat_manager.reset(group_id, topic_id)
    return jsonify({"ok": True})
