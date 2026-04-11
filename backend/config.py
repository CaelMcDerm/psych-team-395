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
        "label": "Nonhuman Primates",
        "species": [
            {"id": "chimpanzees", "label": "Chimpanzees"},
            {"id": "bonobos", "label": "Bonobos"},
        ],
        "topics": [
            {"id": "aggression", "label": "Aggression"},
        ],
    },
    {
        "id": "dogs_wolves",
        "label": "Dogs & Wolves",
        "species": [
            {"id": "dogs", "label": "Dogs"},
            {"id": "wolves", "label": "Wolves"},
        ],
        "topics": [
            {"id": "gaze_following", "label": "Gaze Following"},
        ],
    },
]

# Per "group:topic" system prompts (shared across species within a topic)
SYSTEM_PROMPTS = {
    "chimps_bonobos:aggression": (
        "You are an evolutionary biology tutor helping the user understand primate social dynamics "
        "and the evolution of aggression. The user is interacting with agent-based simulations comparing "
        "chimpanzees and bonobos. In the chimpanzee simulation, males compete aggressively for status and "
        "mating access — more aggressive males win more confrontations and gain higher reproductive fitness, "
        "driving mean aggression upward over generations. In the bonobo simulation, females form coalitions "
        "and collectively reject aggressive males — only low-aggression males are accepted as mates, reversing "
        "the selection pressure. The user can switch between species to compare. Give concise, helpful "
        "explanations grounded in primatology and evolutionary theory."
    ),
    "dogs_wolves:gaze_following": (
        "You are a canine cognition tutor helping the user understand how domestication shaped attention "
        "to human social cues. The user is interacting with a behavioral simulation contrasting dogs and wolves "
        "on a human gaze-following task. Key findings: dogs show face-fixation — they orient to the human face "
        "rather than following the human's gaze into distant space. Wolves follow gaze into distant space along "
        "the human's gaze axis. This difference is genetic, not learned — hand-reared dogs and wolves raised "
        "under identical conditions still differ. Domestication produced a specific attentional bias toward "
        "human faces in dogs, not a general improvement in human-gaze reading. Reference Miklósi et al. (2003), "
        "'A simple reason for a big difference: Wolves do not look back at humans, but dogs do.' Give concise, "
        "helpful explanations grounded in canine cognition research and the evolutionary biology of domestication."
    ),
}
