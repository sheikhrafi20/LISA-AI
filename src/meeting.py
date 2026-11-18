"""Transparent multi-role meeting workflow for LISA.

The roles are prompts routed through the configured LISA provider. They are
not separate autonomous models or external AI services. A final coordinator
summarizes their outputs for the user.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from src.main import get_reply

ROLES = (
    ("Research", "Analyze the task, identify facts to verify, assumptions, and missing information."),
    ("Planner", "Break the task into practical steps, dependencies, and acceptance criteria."),
    ("Critic", "Find risks, weak assumptions, failure cases, and privacy or safety concerns."),
)


def run_meeting(
    task: str,
    history: list[dict[str, str]] | None = None,
    on_update: Callable[[str, str], None] | None = None,
) -> str:
    """Run role-by-role analysis and return one coordinator response.

    Each role receives only the task and a bounded copy of recent conversation.
    The function uses the existing configured provider (Ollama or Anthropic).
    """
    task = task.strip()
    if not task:
        raise ValueError("Task cannot be empty.")

    context = list(history or [])[-8:]
    notes: list[tuple[str, str]] = []
    for name, instruction in ROLES:
        prompt = (
            f"[LISA INTERNAL MEETING — {name} ROLE]\n"
            f"Role instruction: {instruction}\n"
            "Analyze the user's task. Be concise, concrete, and state uncertainty. "
            "Do not claim you used tools or verified facts unless you actually did.\n"
            f"USER TASK:\n{task}"
        )
        result = get_reply(context, prompt)
        notes.append((name, result))
        if on_update:
            on_update(name, result)

    combined = "\n\n".join(f"{name} notes:\n{note}" for name, note in notes)
    coordinator_prompt = (
        "[LISA MEETING — COORDINATOR]\n"
        "Synthesize the following role notes into one useful answer for the user. "
        "Resolve disagreements explicitly, identify unverified assumptions, and give "
        "a practical next step. Do not pretend these are independent AI vendors.\n"
        f"USER TASK:\n{task}\n\nROLE NOTES:\n{combined}"
    )
    return get_reply(context, coordinator_prompt)
