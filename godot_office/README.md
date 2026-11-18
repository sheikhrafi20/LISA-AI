# LISA 3D Virtual AI Office (Godot 4)

This is the first playable foundation for the 3D office. It keeps the existing Python/Ollama LISA backend and adds a local HTTP bridge for Godot.

## Requirements
- Godot 4.x
- Python 3.13 (same environment used by LISA)
- Ollama running with the model configured in the repository's ignored `.env`

## Start the Python AI bridge
Open PowerShell in the repository root:

```powershell
python -m office_bridge.server
```

Keep this terminal open. The bridge binds only to `127.0.0.1:8765`; it is not exposed to your network.

## Open the 3D office
1. Open Godot 4.
2. Choose **Import** and select `godot_office/project.godot`.
3. Open the project and press **F6/F5** (F5 runs the main scene).

Type a task in the office panel and send it to LISA Boss. The Python bridge runs five role prompts (Researcher, Planner, Analyst, Critic, Writer) through the currently configured LISA provider, then asks LISA Boss to synthesize their reports.

## Important current limitations
- This is a procedural 3D blockout, not a photorealistic finished office or human character rig.
- Staff currently use simple 3D placeholder figures. High-quality character models, skeletal walk cycles, hand-to-hand document passing, seated work loops, facial animation and lip sync are later milestones.
- The five staff roles are separate prompts using the same configured model/provider, not five independent AI services.
- The messenger animation is a visual prototype; task execution is performed by the Python backend.
- The current 8 GB, CPU-only laptop may need low render settings and a small Ollama model for responsive use.
