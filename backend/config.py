import os
from dotenv import load_dotenv

load_dotenv()

MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "local")  # "local" | "cloud"

# Cloud config (e.g. Anthropic)
CLOUD_API_URL = "https://api.anthropic.com/v1/messages"
CLOUD_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLOUD_MODEL = "claude-sonnet-4-20250514"

# Local config (e.g. Ollama)
LOCAL_API_URL = os.getenv("LOCAL_API_URL", "http://localhost:11434/api/chat")
LOCAL_MODEL = os.getenv("LOCAL_MODEL", "gemma3:4b")

# Species groups — each group is a top-level tab
SPECIES_GROUPS = [
    {
        "id": "chimps_bonobos",
        "label": "Chimpanzees & Bonobos",
        "species": [
            {"id": "chimpanzees", "label": "Chimpanzees"},
            {"id": "bonobos", "label": "Bonobos"},
        ],
        "topics": [
            {"id": "aggression", "label": "Aggression"},
        ],
    },
]

# Per "group:topic:species" system prompts
SYSTEM_PROMPTS = {
    "chimps_bonobos:aggression:chimpanzees": (
        "You are an evolutionary biology tutor helping the user understand chimpanzee social dynamics "
        "and the evolution of aggression. The user is interacting with an agent-based simulation of a "
        "chimpanzee troop where males compete aggressively for status and mating access. More aggressive "
        "males win more confrontations and gain higher reproductive fitness, driving mean aggression upward "
        "over generations. Give concise, helpful explanations grounded in primatology and evolutionary theory."
    ),
    "chimps_bonobos:aggression:bonobos": (
        "You are an evolutionary biology tutor helping the user understand bonobo social dynamics and how "
        "female mate choice reduces aggression. The user is interacting with an agent-based simulation of a "
        "bonobo group where females form coalitions and collectively reject aggressive males. Only low-aggression "
        "males are accepted as mates, reversing the selection pressure seen in chimpanzees. Give concise, helpful "
        "explanations grounded in primatology and evolutionary theory."
    ),
}
