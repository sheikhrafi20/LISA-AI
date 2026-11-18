extends Node3D

const API := "http://127.0.0.1:8765"
const STAFF := [
    {"name": "RESEARCHER", "title": "Research & Facts", "pos": Vector3(-5.0, 0, -2.0), "outfit": Color(0.20, 0.34, 0.58)},
    {"name": "PLANNER", "title": "Planning & Tasks", "pos": Vector3(-2.5, 0, -2.0), "outfit": Color(0.22, 0.43, 0.48)},
    {"name": "ANALYST", "title": "Analysis", "pos": Vector3(0.0, 0, -2.0), "outfit": Color(0.40, 0.31, 0.58)},
    {"name": "CRITIC", "title": "Quality & Risks", "pos": Vector3(2.5, 0, -2.0), "outfit": Color(0.52, 0.31, 0.27)},
    {"name": "WRITER", "title": "Reports & Output", "pos": Vector3(5.0, 0, -2.0), "outfit": Color(0.24, 0.43, 0.31)}
]

var http: HTTPRequest
var poll: Timer
var busy := false
var seen_notes := 0
var status_label: Label
var progress_label: Label
var task_input: LineEdit
var report_box: RichTextLabel
var courier: Node3D
var courier_tween: Tween
var staff_nodes: Array[Node3D] = []
var boss: Node3D
var office_camera: Camera3D
var camera_tween: Tween
var current_focus := ""
var active_speaker: Node3D


func _ready() -> void:
    _build_office()
    _build_ui()
    http = HTTPRequest.new()
    add_child(http)
    http.request_completed.connect(_on_http_completed)
    poll = Timer.new()
    poll.wait_time = 1.0
    poll.timeout.connect(_poll_status)
    add_child(poll)
    poll.start()
    _poll_status()


func _material(color: Color, metallic := 0.0, roughness := 0.7) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = color
    m.metallic = metallic
    m.roughness = roughness
    return m


func _box(parent: Node3D, label: String, pos: Vector3, size: Vector3, color: Color, metallic := 0.0, roughness := 0.7) -> MeshInstance3D:
    var mesh := BoxMesh.new()
    mesh.size = size
    var node := MeshInstance3D.new()
    node.name = label
    node.mesh = mesh
    node.position = pos
    node.material_override = _material(color, metallic, roughness)
    parent.add_child(node)
    return node


func _sphere(parent: Node3D, label: String, pos: Vector3, radius: float, color: Color) -> MeshInstance3D:
    var mesh := SphereMesh.new()
    mesh.radius = radius
    mesh.height = radius * 2.0
    var node := MeshInstance3D.new()
    node.name = label
    node.mesh = mesh
    node.position = pos
    node.material_override = _material(color)
    parent.add_child(node)
    return node


func _cylinder(parent: Node3D, label: String, pos: Vector3, radius: float, height: float, color: Color) -> MeshInstance3D:
    var mesh := CylinderMesh.new()
    mesh.top_radius = radius
    mesh.bottom_radius = radius
    mesh.height = height
    var node := MeshInstance3D.new()
    node.name = label
    node.mesh = mesh
    node.position = pos
    node.material_override = _material(color)
    parent.add_child(node)
    return node


func _capsule_part(parent: Node3D, label: String, pos: Vector3, radius: float, height: float, color: Color, tilt := 0.0) -> MeshInstance3D:
    var mesh := CapsuleMesh.new()
    mesh.radius = radius
    mesh.height = height
    var node := MeshInstance3D.new()
    node.name = label
    node.mesh = mesh
    node.position = pos
    node.rotation.z = tilt
    node.material_override = _material(color)
    parent.add_child(node)
    return node


func _build_person(parent: Node3D, label: String, pos: Vector3, outfit: Color) -> Node3D:
    var person := Node3D.new()
    person.name = label
    person.position = pos
    parent.add_child(person)

    # Drop a licensed rigged GLB into res://characters using the filenames in README.
    # Godot imports GLB as PackedScene; keep the lightweight fallback if a model is absent.
    var model_path := "res://characters/" + label.to_lower().replace(" ", "_") + ".glb"
    if ResourceLoader.exists(model_path):
        var packed := load(model_path) as PackedScene
        if packed:
            var imported_model := packed.instantiate()
            imported_model.name = "RiggedCharacter"
            imported_model.position = Vector3(0, 0, 0)
            imported_model.scale = Vector3.ONE
            person.add_child(imported_model)
            return person

    # Lightweight fallback while the rigged GLB assets are being added.
    _capsule_part(person, "Torso", Vector3(0, 1.02, 0), 0.27, 0.82, outfit)
    _sphere(person, "Neck", Vector3(0, 1.48, 0), 0.10, Color(0.66, 0.45, 0.34))
    _sphere(person, "Head", Vector3(0, 1.72, 0), 0.25, Color(0.72, 0.52, 0.40))
    _sphere(person, "Hair", Vector3(0, 1.88, -0.035), 0.225, Color(0.12, 0.085, 0.07))
    _capsule_part(person, "Left arm", Vector3(-0.34, 1.03, 0.015), 0.085, 0.62, outfit, -0.18)
    _capsule_part(person, "Right arm", Vector3(0.34, 1.03, 0.015), 0.085, 0.62, outfit, 0.18)
    _sphere(person, "Left hand", Vector3(-0.39, 0.70, 0.04), 0.085, Color(0.72, 0.52, 0.40))
    _sphere(person, "Right hand", Vector3(0.39, 0.70, 0.04), 0.085, Color(0.72, 0.52, 0.40))
    _capsule_part(person, "Left leg", Vector3(-0.13, 0.34, 0), 0.105, 0.58, Color(0.075, 0.09, 0.14))
    _capsule_part(person, "Right leg", Vector3(0.13, 0.34, 0), 0.105, 0.58, Color(0.075, 0.09, 0.14))
    _box(person, "Left shoe", Vector3(-0.13, 0.055, 0.08), Vector3(0.20, 0.10, 0.34), Color(0.035, 0.035, 0.045))
    _box(person, "Right shoe", Vector3(0.13, 0.055, 0.08), Vector3(0.20, 0.10, 0.34), Color(0.035, 0.035, 0.045))
    _sphere(person, "Left eye", Vector3(-0.085, 1.75, 0.215), 0.025, Color(0.025, 0.02, 0.02))
    _sphere(person, "Right eye", Vector3(0.085, 1.75, 0.215), 0.025, Color(0.025, 0.02, 0.02))
    return person


func _build_desk(parent: Node3D, label: String, pos: Vector3, width := 1.65) -> void:
    _box(parent, label + " desktop", pos + Vector3(0, 0.86, 0), Vector3(width, 0.12, 0.82), Color(0.25, 0.17, 0.12), 0.05, 0.38)
    for x in [-width * 0.40, width * 0.40]:
        for z in [-0.27, 0.27]:
            _box(parent, label + " leg", pos + Vector3(x, 0.42, z), Vector3(0.075, 0.82, 0.075), Color(0.12, 0.13, 0.16), 0.55)
    _box(parent, label + " monitor frame", pos + Vector3(0, 1.34, -0.22), Vector3(0.78, 0.48, 0.075), Color(0.035, 0.045, 0.065), 0.35)
    _box(parent, label + " monitor screen", pos + Vector3(0, 1.34, -0.176), Vector3(0.69, 0.39, 0.012), Color(0.08, 0.34, 0.48), 0.1, 0.25)
    _box(parent, label + " keyboard", pos + Vector3(0, 0.94, 0.22), Vector3(0.52, 0.035, 0.16), Color(0.055, 0.06, 0.075))
    _box(parent, label + " chair seat", pos + Vector3(0, 0.48, 0.88), Vector3(0.62, 0.12, 0.58), Color(0.12, 0.14, 0.20))
    _box(parent, label + " chair back", pos + Vector3(0, 0.91, 1.13), Vector3(0.62, 0.78, 0.12), Color(0.12, 0.14, 0.20))


func _build_plant(parent: Node3D, pos: Vector3) -> void:
    _cylinder(parent, "Plant pot", pos + Vector3(0, 0.28, 0), 0.28, 0.48, Color(0.20, 0.16, 0.15))
    _cylinder(parent, "Plant stem", pos + Vector3(0, 0.85, 0), 0.045, 0.78, Color(0.12, 0.25, 0.15))
    for i in range(6):
        var angle := TAU * float(i) / 6.0
        _sphere(parent, "Plant leaf", pos + Vector3(cos(angle) * 0.28, 0.92 + float(i % 2) * 0.18, sin(angle) * 0.22), 0.19, Color(0.12, 0.34, 0.22))


func _build_office() -> void:
    var world := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(0.025, 0.035, 0.06)
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(0.62, 0.66, 0.82)
    env.ambient_light_energy = 0.72
    world.environment = env
    add_child(world)

    # Main floor, architectural shell and ceiling.
    _box(self, "Main polished floor", Vector3(0, -0.12, 0), Vector3(17, 0.24, 12), Color(0.105, 0.12, 0.17), 0.28, 0.24)
    _box(self, "Back wall", Vector3(0, 2.1, -6), Vector3(17, 4.2, 0.2), Color(0.075, 0.09, 0.14))
    _box(self, "Left wall", Vector3(-8.5, 2.1, 0), Vector3(0.2, 4.2, 12), Color(0.07, 0.08, 0.13))
    _box(self, "Right wall", Vector3(8.5, 2.1, 0), Vector3(0.2, 4.2, 12), Color(0.07, 0.08, 0.13))
    _box(self, "Ceiling", Vector3(0, 4.25, 0), Vector3(17, 0.16, 12), Color(0.055, 0.065, 0.10))
    _box(self, "Ceiling light strip", Vector3(0, 4.14, -1.0), Vector3(10, 0.035, 0.16), Color(0.66, 0.76, 1.0), 0.0, 0.25)

    # Back-wall windows with slim frames.
    for x in [-5.8, -2.0, 2.0, 5.8]:
        _box(self, "Blue tinted window", Vector3(x, 2.45, -5.87), Vector3(2.65, 2.25, 0.045), Color(0.10, 0.23, 0.34), 0.25, 0.18)
        _box(self, "Window mullion", Vector3(x, 2.45, -5.82), Vector3(0.045, 2.25, 0.05), Color(0.34, 0.40, 0.52), 0.5)
    _box(self, "Reception feature wall", Vector3(0, 2.3, -5.72), Vector3(3.2, 1.25, 0.08), Color(0.12, 0.15, 0.24))
    _box(self, "LISA wall sign", Vector3(0, 2.42, -5.65), Vector3(1.9, 0.34, 0.035), Color(0.20, 0.42, 0.72), 0.1)

    var key := DirectionalLight3D.new()
    key.rotation_degrees = Vector3(-48, -25, 0)
    key.light_energy = 1.05
    key.shadow_enabled = true
    add_child(key)

    # Executive suite is separated from the staff floor by glass partitions.
    _box(self, "Executive rear glass", Vector3(0, 1.65, 2.05), Vector3(7.8, 3.3, 0.10), Color(0.10, 0.20, 0.31, 0.58), 0.15, 0.2)
    _box(self, "Executive left glass", Vector3(-3.9, 1.65, 3.55), Vector3(0.10, 3.3, 3.0), Color(0.10, 0.20, 0.31, 0.48), 0.15, 0.2)
    _box(self, "Executive right glass", Vector3(3.9, 1.65, 3.55), Vector3(0.10, 3.3, 3.0), Color(0.10, 0.20, 0.31, 0.48), 0.15, 0.2)
    _box(self, "Executive rug", Vector3(0, 0.015, 3.55), Vector3(7.4, 0.035, 3.0), Color(0.12, 0.13, 0.22))
    _build_desk(self, "LISA executive", Vector3(0, 0, 4.1), 3.0)
    boss = _build_person(self, "LISA BOSS", Vector3(0, 0, 3.0), Color(0.28, 0.22, 0.48))
    _label_3d(boss, "LISA  •  BOSS", Vector3(0, 2.25, 0))

    # Five individual staff stations.
    for member in STAFF:
        var p: Vector3 = member.pos
        _build_desk(self, str(member.name), p, 1.65)
        var worker := _build_person(self, str(member.name), p + Vector3(0, 0, 0.65), member.outfit)
        _label_3d(worker, str(member.name), Vector3(0, 2.15, 0))
        staff_nodes.append(worker)

    # Messenger station and visible work-order sheet.
    courier = _build_person(self, "MESSENGER", Vector3(-6.5, 0, 2.0), Color(0.42, 0.27, 0.16))
    _box(courier, "Work order document", Vector3(0.42, 1.10, 0.16), Vector3(0.24, 0.34, 0.035), Color(0.94, 0.91, 0.78))
    _build_plant(self, Vector3(-7.4, 0, -5.0))
    _build_plant(self, Vector3(7.4, 0, -5.0))
    _build_plant(self, Vector3(7.4, 0, 4.8))

    office_camera = Camera3D.new()
    office_camera.position = Vector3(0, 11.5, 17.5)
    office_camera.rotation_degrees = Vector3(-29, 0, 0)
    office_camera.current = true
    add_child(office_camera)


func _label_3d(parent: Node3D, value: String, offset: Vector3) -> void:
    var label := Label3D.new()
    label.text = value
    label.position = offset
    label.font_size = 30
    label.modulate = Color(0.88, 0.86, 1.0)
    parent.add_child(label)


func _build_ui() -> void:
    var layer := CanvasLayer.new()
    add_child(layer)
    var panel := PanelContainer.new()
    panel.position = Vector2(18, 18)
    panel.size = Vector2(370, 250)
    layer.add_child(panel)
    var layout := VBoxContainer.new()
    layout.add_theme_constant_override("separation", 8)
    panel.add_child(layout)
    var title := Label.new()
    title.text = "LISA  |  3D VIRTUAL OFFICE"
    title.add_theme_font_size_override("font_size", 20)
    layout.add_child(title)
    status_label = Label.new()
    status_label.text = "Connecting to local LISA backend..."
    layout.add_child(status_label)
    task_input = LineEdit.new()
    task_input.placeholder_text = "Write a task for the Boss..."
    task_input.text_submitted.connect(_submit_task)
    layout.add_child(task_input)
    var send := Button.new()
    send.text = "SEND WORK ORDER TO BOSS"
    send.pressed.connect(func(): _submit_task(task_input.text))
    layout.add_child(send)
    progress_label = Label.new()
    progress_label.text = "Staff: 5  |  Messenger: 1"
    layout.add_child(progress_label)
    report_box = RichTextLabel.new()
    report_box.custom_minimum_size = Vector2(340, 95)
    report_box.fit_content = false
    report_box.scroll_following = true
    report_box.text = "Five AI staff members are ready."
    layout.add_child(report_box)


func _submit_task(value: String) -> void:
    var task := value.strip_edges()
    if task.is_empty() or busy:
        return
    var body := JSON.stringify({"task": task})
    var err := http.request(API + "/api/task", PackedStringArray(["Content-Type: application/json"]), HTTPClient.METHOD_POST, body)
    if err != OK:
        status_label.text = "Could not contact LISA bridge. Start Python bridge first."
        return
    busy = true
    seen_notes = 0
    task_input.clear()
    status_label.text = "Sending work order to LISA Boss..."
    _animate_courier()


func _animate_courier() -> void:
    if courier_tween and courier_tween.is_running():
        courier_tween.kill()
    courier.position = Vector3(-6.5, 0, 2.0)
    courier_tween = create_tween()
    courier_tween.tween_property(courier, "position", Vector3(0, 0, 3.0), 1.8)
    for member in STAFF:
        courier_tween.tween_property(courier, "position", member.pos + Vector3(0, 0, 1.1), 1.25)
    courier_tween.tween_property(courier, "position", Vector3(0, 0, 3.0), 1.8)


func _poll_status() -> void:
    if http.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
        return
    var err := http.request(API + "/api/status")
    if err != OK:
        status_label.text = "Bridge offline — run: python -m office_bridge.server"


func _on_http_completed(result: int, _code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
    if result != HTTPRequest.RESULT_SUCCESS:
        status_label.text = "Backend connection failed."
        return
    var parsed = JSON.parse_string(body.get_string_from_utf8())
    if not parsed is Dictionary:
        return
    if parsed.has("accepted"):
        status_label.text = "Work order accepted. Messenger is delivering it..."
    elif parsed.has("state"):
        _update_from_status(parsed)


func _update_from_status(data: Dictionary) -> void:
    var state := str(data.get("state", "idle"))
    var current := str(data.get("current_role", ""))
    if not current.is_empty() and current != current_focus:
        current_focus = current
        _focus_character(_find_character(current), false)
    status_label.text = "OFFICE: " + state.to_upper() + (("  •  " + current) if not current.is_empty() else "")
    progress_label.text = "Staff reports: %s / 5" % str(data.get("completed", 0))
    var notes: Array = data.get("notes", [])
    while seen_notes < notes.size():
        var note: Dictionary = notes[seen_notes]
        report_box.append_text("\n\n[b]" + str(note.get("role", "Staff")) + " report[/b]\n" + str(note.get("result", "")))
        seen_notes += 1
    if state == "completed":
        report_box.append_text("\n\n[b]LISA BOSS — FINAL REPORT[/b]\n" + str(data.get("final", "")))
        status_label.text = "LISA BOSS IS PRESENTING THE FINAL REPORT"
        _focus_character(boss, true)
        busy = false
    elif state == "error":
        report_box.append_text("\n\n[ERROR] " + str(data.get("error", "Unknown error")))
        busy = false


func _find_character(role: String) -> Node3D:
    var key := role.to_lower()
    if key.contains("boss") or key.contains("coordinator"):
        return boss
    if key.contains("research"):
        return staff_nodes[0] if staff_nodes.size() > 0 else null
    if key.contains("plan"):
        return staff_nodes[1] if staff_nodes.size() > 1 else null
    if key.contains("anal"):
        return staff_nodes[2] if staff_nodes.size() > 2 else null
    if key.contains("critic") or key.contains("quality"):
        return staff_nodes[3] if staff_nodes.size() > 3 else null
    if key.contains("writ"):
        return staff_nodes[4] if staff_nodes.size() > 4 else null
    return null


func _focus_character(character: Node3D, final_report: bool) -> void:
    if character == null or office_camera == null:
        return
    active_speaker = character
    var target := character.global_position + Vector3(0, 1.45, 0)
    var camera_offset := Vector3(0, 2.0, 4.2) if final_report else Vector3(0, 2.2, 5.2)
    if camera_tween and camera_tween.is_running():
        camera_tween.kill()
    camera_tween = create_tween()
    camera_tween.set_parallel(true)
    camera_tween.tween_property(office_camera, "global_position", target + camera_offset, 0.9)
    camera_tween.tween_callback(func(): office_camera.look_at(target, Vector3.UP)).set_delay(0.92)
