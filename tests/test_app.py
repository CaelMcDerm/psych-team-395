"""
Tests for routing, input validation, session management, and config data
structures. The LLM call is mocked — no Ollama or Anthropic connection needed.
"""
import json
from unittest.mock import patch

import chat_manager
import config


# ---------------------------------------------------------------------------
# Routing — GET /api/groups
# ---------------------------------------------------------------------------

def test_get_groups_returns_200(client):
    resp = client.get("/api/groups")
    assert resp.status_code == 200


def test_get_groups_returns_list_with_required_fields(client):
    """Every group in the response has the four fields the frontend depends on."""
    data = client.get("/api/groups").get_json()
    assert isinstance(data, list) and len(data) > 0
    for group in data:
        for field in ("id", "label", "species", "topics"):
            assert field in group, f"Group {group.get('id')!r} missing field {field!r}"


# ---------------------------------------------------------------------------
# Input validation — POST /api/chat
# ---------------------------------------------------------------------------

def test_chat_missing_message_returns_400(client):
    """Omitting the message field returns 400 with an error body."""
    resp = client.post(
        "/api/chat",
        data=json.dumps({"groupId": "chimps_bonobos", "topicId": "aggression"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_chat_missing_group_id_returns_400(client):
    """Omitting groupId returns 400."""
    resp = client.post(
        "/api/chat",
        data=json.dumps({"topicId": "aggression", "message": "hello"}),
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_chat_reset_missing_topic_returns_400(client):
    """Omitting topicId from the reset endpoint returns 400."""
    resp = client.post(
        "/api/chat/reset",
        data=json.dumps({"groupId": "chimps_bonobos"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "error" in resp.get_json()


# ---------------------------------------------------------------------------
# Routing — POST /api/chat/reset
# ---------------------------------------------------------------------------

def test_chat_reset_returns_ok(client):
    """A well-formed reset request returns {"ok": true}."""
    resp = client.post(
        "/api/chat/reset",
        data=json.dumps({"groupId": "chimps_bonobos", "topicId": "aggression"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.get_json().get("ok") is True


# ---------------------------------------------------------------------------
# Chat success path (LLM mocked)
# ---------------------------------------------------------------------------

def test_chat_returns_reply_and_transfer_flag(client):
    """A well-formed request returns a reply string and a transfer_passed bool."""
    with patch("routes.chat.call_local_api", return_value="That's a good observation."):
        resp = client.post(
            "/api/chat",
            data=json.dumps({
                "groupId": "chimps_bonobos",
                "topicId": "aggression",
                "message": "Why does aggression increase over generations?",
            }),
            content_type="application/json",
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert "reply" in body
    assert isinstance(body["transfer_passed"], bool)


def test_chat_transfer_marker_stripped_from_reply(client):
    """[TRANSFER_PASSED] is removed from the visible reply text."""
    raw = "You reasoned through that correctly.\n[TRANSFER_PASSED]"
    with patch("routes.chat.call_local_api", return_value=raw):
        resp = client.post(
            "/api/chat",
            data=json.dumps({
                "groupId": "chimps_bonobos",
                "topicId": "aggression",
                "message": "Elephants are prosocial because aggression is selected against.",
            }),
            content_type="application/json",
        )
    body = resp.get_json()
    assert "[TRANSFER_PASSED]" not in body["reply"]
    assert "You reasoned through that correctly." in body["reply"]


def test_chat_llm_failure_returns_502(client):
    """If the LLM call raises, the route returns 502 with an error body."""
    with patch("routes.chat.call_local_api", side_effect=Exception("connection refused")):
        resp = client.post(
            "/api/chat",
            data=json.dumps({
                "groupId": "chimps_bonobos",
                "topicId": "aggression",
                "message": "hello",
            }),
            content_type="application/json",
        )
    assert resp.status_code == 502
    assert "error" in resp.get_json()


# ---------------------------------------------------------------------------
# Session management — chat_manager guest sessions
# ---------------------------------------------------------------------------

def test_guest_session_append_and_retrieve():
    """Messages appended for a guest are retrievable under the same guest ID."""
    chat_manager.append(None, "dogs_wolves", "gaze_following", "user", "Hello", guest_id="g1")
    chat_manager.append(None, "dogs_wolves", "gaze_following", "assistant", "Hi.", guest_id="g1")
    history = chat_manager.get_history(None, "dogs_wolves", "gaze_following", guest_id="g1")
    assert len(history) == 2
    assert history[0] == {"role": "user", "content": "Hello"}
    assert history[1] == {"role": "assistant", "content": "Hi."}


def test_guest_session_reset_clears_history():
    """Resetting a guest session empties its history."""
    chat_manager.append(None, "humans", "self_domestication", "user", "Will be cleared", guest_id="g2")
    chat_manager.reset(None, "humans", "self_domestication", guest_id="g2")
    history = chat_manager.get_history(None, "humans", "self_domestication", guest_id="g2")
    assert history == []


def test_guest_sessions_are_isolated():
    """Two different guest IDs do not share history."""
    chat_manager.append(None, "elephants", "theory_of_mind", "user", "Secret", guest_id="ga")
    other = chat_manager.get_history(None, "elephants", "theory_of_mind", guest_id="gb")
    assert other == []


# ---------------------------------------------------------------------------
# Config data structures
# ---------------------------------------------------------------------------

def test_all_group_topic_keys_have_system_prompts():
    """
    Every group:topic composite key in SPECIES_GROUPS has a matching entry in
    SYSTEM_PROMPTS. Catches the case where a new simulation is added to the
    taxonomy without a corresponding prompt.
    """
    for group in config.SPECIES_GROUPS:
        for topic in group["topics"]:
            key = f"{group['id']}:{topic['id']}"
            assert key in config.SYSTEM_PROMPTS, f"No system prompt for key '{key}'"


def test_get_system_prompt_nonempty_for_valid_keys():
    """get_system_prompt returns a non-empty string for every valid key."""
    for group in config.SPECIES_GROUPS:
        for topic in group["topics"]:
            prompt = config.get_system_prompt(group["id"], topic["id"])
            assert isinstance(prompt, str) and len(prompt) > 0


def test_get_system_prompt_unknown_key_returns_string():
    """An unknown key does not raise — it returns a string."""
    result = config.get_system_prompt("nonexistent_group", "nonexistent_topic")
    assert isinstance(result, str)
