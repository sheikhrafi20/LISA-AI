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


## Character asset upgrade (GLB-ready)

The office now supports rigged humanoid GLB scenes. Put properly licensed character files in `godot_office/characters/` with these exact names:

- `lisa_boss.glb`
- `researcher.glb`
- `planner.glb`
- `analyst.glb`
- `critic.glb`
- `writer.glb`
- `messenger.glb`

Each file should contain a humanoid mesh and a `Skeleton3D`; ideally include Idle, Walk and Talk/gesture clips in an `AnimationPlayer`. Keep model scale close to 1.7–1.9 metres tall and orient the character's face toward local +Z. If a file is missing, the scene falls back to the simple procedural figure.

The camera now follows the active staff role when a report is being processed and moves to a closer front-facing shot of LISA Boss when the final report is ready. This is a camera focus/presentation step only: it does not yet create true facial lip-sync or real paper hand-to-hand animation.

### Animation integration status

GLB loading is wired, but animation playback, synchronized walking, hand attachment/document transfer, voice output and lip-sync are still pending. Godot imports glTF/GLB scenes and their AnimationPlayer tracks; AnimationTree can then blend imported clips. See the [Godot scene import guide](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/index.html) and [AnimationTree guide](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html).

### Current laptop profile

Use low-poly or optimized GLB models (preferably under about 10–15 MB each), 1K textures or smaller, and avoid high-poly hair/cloth simulation on the 8 GB CPU-only laptop.
