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
LOCAL_MODEL = os.getenv("LOCAL_MODEL", "qwen3-vl:8b")

# Topic definitions
TOPICS = [
    {
        "id": "topic_1",
        "label": "Pendulum",
        "description": "Explore the dynamics of a simple pendulum. Adjust length, gravity, and damping to observe changes in oscillation.",
        "system_prompt": "You are a physics tutor helping the user understand pendulum dynamics. The user is interacting with a pendulum simulation where they can adjust length, gravity, and damping. Give concise, helpful explanations."
    },
    {
        "id": "topic_2",
        "label": "Wave Interference",
        "description": "Visualize the superposition of two sinusoidal waves. Control frequency, amplitude, and phase offset.",
        "system_prompt": "You are a physics tutor helping the user understand wave interference and superposition. The user is interacting with a wave simulation where they can adjust frequency, amplitude, and phase. Give concise, helpful explanations."
    },
    {
        "id": "topic_3",
        "label": "Projectile Motion",
        "description": "Simulate projectile trajectories under gravity. Adjust launch angle, initial velocity, and air resistance.",
        "system_prompt": "You are a physics tutor helping the user understand projectile motion. The user is interacting with a projectile simulation where they can adjust angle, velocity, and air resistance. Give concise, helpful explanations."
    },
    {
        "id": "topic_4",
        "label": "Spring-Mass System",
        "description": "Model a spring-mass oscillator. Control spring constant, mass, and initial displacement.",
        "system_prompt": "You are a physics tutor helping the user understand spring-mass harmonic oscillation. The user is interacting with a spring-mass simulation where they can adjust spring constant, mass, and displacement. Give concise, helpful explanations."
    },
]
