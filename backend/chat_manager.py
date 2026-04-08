from config import SYSTEM_PROMPTS

# In-memory sessions keyed by "group:topic:species"
sessions: dict[str, list[dict]] = {}


def _key(group_id: str, topic_id: str, species_id: str) -> str:
    return f"{group_id}:{topic_id}:{species_id}"


def get_history(group_id: str, topic_id: str, species_id: str) -> list[dict]:
    k = _key(group_id, topic_id, species_id)
    if k not in sessions:
        sessions[k] = []
    return sessions[k]


def append(group_id: str, topic_id: str, species_id: str, role: str, content: str) -> list[dict]:
    history = get_history(group_id, topic_id, species_id)
    history.append({"role": role, "content": content})
    return history


def reset(group_id: str, topic_id: str, species_id: str) -> None:
    k = _key(group_id, topic_id, species_id)
    sessions[k] = []


def get_system_prompt(group_id: str, topic_id: str, species_id: str) -> str:
    k = _key(group_id, topic_id, species_id)
    return SYSTEM_PROMPTS.get(k, "You are a helpful assistant.")
