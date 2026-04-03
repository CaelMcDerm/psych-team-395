from config import TOPICS

# In-memory sessions keyed by topic_id
sessions: dict[str, list[dict]] = {}

# Map topic_id -> system prompt
_system_prompts = {t["id"]: t["system_prompt"] for t in TOPICS}


def get_history(topic_id: str) -> list[dict]:
    if topic_id not in sessions:
        sessions[topic_id] = []
    return sessions[topic_id]


def append(topic_id: str, role: str, content: str) -> list[dict]:
    history = get_history(topic_id)
    history.append({"role": role, "content": content})
    return history


def reset(topic_id: str) -> None:
    sessions[topic_id] = []


def get_system_prompt(topic_id: str) -> str:
    return _system_prompts.get(topic_id, "You are a helpful assistant.")
