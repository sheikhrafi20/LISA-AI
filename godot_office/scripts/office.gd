extends Node3D

const API := "http://127.0.0.1:8765"
const STAFF := [
    {"name": "RESEARCHER", "title": "Research & Facts", "pos": Vector3(-5.0, 0, -2.0)},
    {"name": "PLANNER", "title": "Planning & Tasks", "pos": Vector3(-2.5, 0, -2.0)},
    {"name": "ANALYST", "title": "Analysis", "pos": Vector3(0.0, 0, -2.0)},
    {"name": "CRITIC", "title": "Quality & Risks", "pos": Vector3(2.5, 0, -2.0)},
    {"name": "WRITER", "title": "Reports & Output", "pos": Vector3(5.0, 0, -2.0)}
]

var http: HTTPRequest
var poll: Timer
var busy := false
var seen_notes := 0
var last_state := ""
var status_label: Label
var progress_label: Label
var task_input: LineEdit
var report_box: RichTextLabel
var courier: Node3D
var courier_tween: Tween
var staff_nodes: Array[Node3D] = []
var boss: Node3D


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


func _box(parent: Node3D, label: String, pos: Vector3, size: Vector3, color: Color) -> MeshInstance3D:
    var mesh := BoxMesh.new()
    mesh.size = size
    var node := MeshInstance3D.new()
    node.name = label
    node.mesh = mesh
    node.position = pos
    node.material_override = _material(color)
    parent.add_child(node)
    return node


func _build_person(parent: Node3D, label: String, pos: Vector3, outfit: Color) -> Node3D:
    var person := Node3D.new()
    person.name = label
    person.position = pos
    parent.add_child(person)
    var body := MeshInstance3D.new()
    var capsule := CapsuleMesh.new()
    capsule.radius = 0.32
    capsule.height = 1.25
    body.mesh = capsule
    body.position.y = 0.85
    body.material_override = _material(outfit)
    person.add_child(body)
    var head := MeshInstance3D.new()
    var sphere := SphereMesh.new()
    sphere.radius = 0.24
    sphere.height = 0.48
    head.mesh = sphere
    head.position.y = 1.62
    head.material_override = _material(Color(0.78, 0.57, 0.43))
    person.add_child(head)
    return person


func _build_office() -> void:
    var world := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(0.035, 0.045, 0.075)
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(0.58, 0.62, 0.82)
    env.ambient_light_energy = 0.65
    world.environment = env
    add_child(world)

    var floor := _box(self, "Polished office floor", Vector3(0, -0.12, 0), Vector3(17, 0.24, 12), Color(0.12, 0.13, 0.19))
    floor.material_override = _material(Color(0.12, 0.13, 0.19), 0.22, 0.28)
    _box(self, "Back wall", Vector3(0, 2.1, -6), Vector3(17, 4.2, 0.2), Color(0.09, 0.10, 0.16))
    _box(self, "Left wall", Vector3(-8.5, 2.1, 0), Vector3(0.2, 4.2, 12), Color(0.08, 0.09, 0.14))
    _box(self, "Right wall", Vector3(8.5, 2.1, 0), Vector3(0.2, 4.2, 12), Color(0.08, 0.09, 0.14))

    var key := DirectionalLight3D.new()
    key.rotation_degrees = Vector3(-48, -25, 0)
    key.light_energy = 1.15
    key.shadow_enabled = true
    add_child(key)

    # Executive office: glass-like divider and boss desk.
    _box(self, "Executive divider", Vector3(0, 1.55, 3.4), Vector3(7.2, 3.1, 0.12), Color(0.12, 0.18, 0.27, 0.72))
    _box(self, "Boss desk", Vector3(0, 0.55, 4.2), Vector3(3.2, 0.18, 1.1), Color(0.24, 0.16, 0.12))
    boss = _build_person(self, "LISA BOSS", Vector3(0, 0, 3.25), Color(0.28, 0.22, 0.48))
    _label_3d(boss, "LISA  •  BOSS", Vector3(0, 2.05, 0))

    for member in STAFF:
        var p: Vector3 = member.pos
        _box(self, str(member.name) + " desk", p + Vector3(0, 0.52, 0), Vector3(1.65, 0.16, 0.85), Color(0.22, 0.18, 0.15))
        _box(self, str(member.name) + " monitor", p + Vector3(0, 1.05, -0.27), Vector3(0.72, 0.48, 0.08), Color(0.035, 0.12, 0.18))
        var worker := _build_person(self, str(member.name), p + Vector3(0, 0, 0.72), Color(0.20, 0.28, 0.43))
        _label_3d(worker, str(member.name), Vector3(0, 2.05, 0))
        staff_nodes.append(worker)

    courier = _build_person(self, "MESSENGER", Vector3(-6.5, 0, 2.0), Color(0.35, 0.24, 0.16))
    _box(courier, "Work order document", Vector3(0.42, 1.12, -0.12), Vector3(0.24, 0.34, 0.035), Color(0.94, 0.91, 0.78))

    var camera := Camera3D.new()
    camera.position = Vector3(0, 10.5, 15.5)
    camera.rotation_degrees = Vector3(-28, 0, 0)
    camera.current = true
    add_child(camera)


func _label_3d(parent: Node3D, value: String, offset: Vector3) -> void:
    var label := Label3D.new()
    label.text = value
    label.position = offset
    label.font_size = 32
    label.modulate = Color(0.86, 0.82, 1.0)
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


func _on_http_completed(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
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
    status_label.text = "OFFICE: " + state.to_upper() + (("  •  " + current) if not current.is_empty() else "")
    progress_label.text = "Staff reports: %s / 5" % str(data.get("completed", 0))
    var notes: Array = data.get("notes", [])
    while seen_notes < notes.size():
        var note: Dictionary = notes[seen_notes]
        report_box.append_text("\n\n[b]" + str(note.get("role", "Staff")) + " report[/b]\n" + str(note.get("result", "")))
        seen_notes += 1
    if state == "completed":
        report_box.append_text("\n\n[b]LISA BOSS — FINAL REPORT[/b]\n" + str(data.get("final", "")))
        busy = false
    elif state == "error":
        report_box.append_text("\n\n[ERROR] " + str(data.get("error", "Unknown error")))
        busy = false
