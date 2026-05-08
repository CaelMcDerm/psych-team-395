from config import SYSTEM_PROMPTS

# In-memory fallback for guest users, keyed by "guest_id:group:topic"
_guest_sessions: dict[str, list[dict]] = {}


def _guest_key(guest_id: str, group_id: str, topic_id: str) -> str:
    return f"{guest_id}:{group_id}:{topic_id}"


def get_history(user_id, group_id: str, topic_id: str, guest_id: str = None) -> list[dict]:
    if user_id is not None:
        from models import ChatMessage
        messages = (
            ChatMessage.query
            .filter_by(user_id=user_id, group_id=group_id, topic_id=topic_id)
            .order_by(ChatMessage.created_at)
            .all()
        )
        return [{"role": m.role, "content": m.content} for m in messages]
    k = _guest_key(guest_id or "anon", group_id, topic_id)
    return list(_guest_sessions.get(k, []))


def append(user_id, group_id: str, topic_id: str, role: str, content: str, guest_id: str = None) -> None:
    if user_id is not None:
        from models import db, ChatMessage
        db.session.add(ChatMessage(
            user_id=user_id, group_id=group_id, topic_id=topic_id,
            role=role, content=content,
        ))
        db.session.commit()
        return
    k = _guest_key(guest_id or "anon", group_id, topic_id)
    if k not in _guest_sessions:
        _guest_sessions[k] = []
    _guest_sessions[k].append({"role": role, "content": content})


def reset(user_id, group_id: str, topic_id: str, guest_id: str = None) -> None:
    if user_id is not None:
        from models import db, ChatMessage
        ChatMessage.query.filter_by(
            user_id=user_id, group_id=group_id, topic_id=topic_id,
        ).delete()
        db.session.commit()
        return
    k = _guest_key(guest_id or "anon", group_id, topic_id)
    _guest_sessions.pop(k, None)


def get_system_prompt(group_id: str, topic_id: str) -> str:
    k = f"{group_id}:{topic_id}"
    return SYSTEM_PROMPTS.get(k, "You are a helpful assistant.")
