# 虚拟宇宙：场景意图协议 + 四层架构设计

> 状态：设计草案
> 范围：现实世界 ↔ 虚拟世界入口 agent 的渲染与编排架构
> 关联代码：`src-tauri/src/agent.rs`、`src-tauri/src/vu_player.rs`、`src-tauri/src/virtual_universe.rs`、`agent-controller/agent_stream.py`

---

## 0. 一句话定位

本方案不是"换一个更强的渲染器"，而是**定义一套让 agent 能声明式控制场景的协议，再选一个"场景即数据"的引擎去确定性执行它**。摄像头采集只是感知层的起点，最终形态是一个"现实世界 → 虚拟世界"的入口 agent：它感知现实、维护世界模型、编排虚拟场景，但不亲自逐帧绘制。

---

## 1. 核心原则：快回路与慢回路必须解耦

这是整个架构的第一性约束，违反它后面全是坑。

| | 慢回路（编排） | 快回路（渲染） |
|---|---|---|
| 主体 | Agent（LLM / 规则引擎） | 渲染引擎 |
| 频率 | 秒级、事件驱动 | 60~120fps、硬实时 |
| 输入 | 现实世界状态（感知层结构化结果） | 场景描述 + 最新意图 |
| 输出 | **场景意图**（声明式） | 帧 |

**关键结论：**

1. **Agent 绝不出现在渲染循环里逐帧决策。** LLM 单次推理几百 ms ~ 秒级，与 8~16ms 的帧预算差两个数量级。
2. **Agent 输出的不是"帧"，而是"场景状态 + 增量意图"。** 渲染引擎把这份声明式场景在每一帧确定性地展开成画面。
3. **两条回路通过"最新意图槽"通信**，与本项目 `vu_player.rs` 中 `FrameSlot`（只保留最新一帧、永不排队）的思想完全一致：渲染循环永远只应用"最新那份意图"，agent 卡顿/思考两秒不影响画面帧率。

> 类比：**Agent 是导演，渲染引擎是摄影棚。** 导演说"镜头推向主角、把灯光调暖、下点雨"，摄影棚以 120fps 执行。导演不逐像素指挥。

---

## 2. 四层架构

```
现实世界
   │  摄像头（现有：nokhwa 采集）
   ▼
┌─────────────────────────────────────────────────────────┐
│ L1 感知层  Perception                                     │
│   解码 / 姿态估计 / 语义分割 / SLAM                        │
│   现址：vu_player.rs 的采集线程 + FrameSlot               │
└─────────────────────────────────────────────────────────┘
   │  感知结果（结构化：人、物体、位置、朝向……）
   ▼
┌─────────────────────────────────────────────────────────┐
│ L2 世界模型层  World Model                                │
│   把现实映射成结构化状态：谁在哪、场景语义、时间线          │
│   纯数据，不含渲染；可持久化、可回放                       │
└─────────────────────────────────────────────────────────┘
   │  世界状态快照
   ▼
┌─────────────────────────────────────────────────────────┐
│ L3 编排层  Agent（慢回路）                                │
│   读世界状态 → 产出「场景意图」(Scene Intent)             │
│   现址：agent-controller/agent_stream.py（常驻进程）       │
└─────────────────────────────────────────────────────────┘
   │  场景意图（声明式 + 增量 + 可回放）→ 最新意图槽
   ▼
┌─────────────────────────────────────────────────────────┐
│ L4 渲染层  Renderer（快回路）                             │
│   每帧把「意图应用后的场景状态」确定性地展开成画面          │
│   目标：Bevy (Rust) 或 three.js in Tauri webview         │
└─────────────────────────────────────────────────────────┘
   │
   ▼
虚拟世界画面  ──（可选）反馈回现实：指令、音频、机械动作
```

**分层纪律：**

- 低层不知道高层。渲染层不认识"agent"，只认识"场景意图"。
- 高层不碰像素。agent 不认识 GPU、shader、纹理。
- 相邻层之间用**显式数据契约**（结构体 / JSON）通信，不共享可变内存。

---

## 3. 世界里唯一的契约：场景意图协议（SIP）

Scene Intent Protocol 是 agent 与渲染器之间的**唯一接口**，也是本方案最该先设计、最值得投入的工件。

### 3.1 设计三原则

1. **声明式（declarative）**：描述"世界应该是什么样"，而非"怎么画"。`set_material wetness=0.6`，不是"画一个高光点"。
2. **增量（incremental）**：一次只发变化（diff），不是全量重发。降低带宽、天然支持补间。
3. **可回放（replayable）**：意图流是有序、可持久化、可确定性重放的事件序列。出错能复现，agent 能缓存，A/B 能对比。

### 3.2 消息结构

一次"编排步"产出一个 `SceneIntent`，内含有序命令数组：

```jsonc
{
  "intentId": "i-000123",
  "worldId": "entry-01",
  "ts": 1735689600.123,          // 服务端时间戳，用于回放与对齐
  "baseRev": 42,                 // 基于的最新场景版本，用于乐观并发 / 丢弃过期意图
  "commands": [
    { "op": "spawn_entity", "id": "avatar-self", "kind": "mesh://self-body" },
    { "op": "set_transform", "id": "avatar-self", "pos": [0, 0, 1.2], "yaw": 0.1 },
    { "op": "set_env",       "light": { "timeOfDay": "dusk", "intensity": 0.7 } },
    { "op": "set_camera",    "mode": "follow", "target": "avatar-self", "easing": "smooth" },
    { "op": "set_material",  "id": "ground", "wetness": 0.6 },
    { "op": "play_effect",   "id": "rain", "opacity": 0.4 }
  ]
}
```

### 3.3 命令词汇表（初版，可扩展）

| op | 语义 | 关键字段 |
|---|---|---|
| `spawn_entity` | 生成实体 | `id`, `kind`(资源引用), `transform?` |
| `despawn_entity` | 销毁实体 | `id` |
| `set_transform` | 设置位置/朝向 | `id`, `pos`, `rot`/`yaw` |
| `set_camera` | 相机模式与目标 | `mode`(free/follow/orbit/fixed), `target`, `easing` |
| `set_env` | 环境（光照/天气/时间） | `light`, `weather`, `timeOfDay` |
| `set_material` | 材质参数 | `id`, 任意 material 属性键值 |
| `play_anim` / `play_effect` | 播放动画/特效 | `id`, `loop`, `opacity` |
| `set_ui` | 世界内 HUD/字幕 | `slot`, `content` |

**兼容规则：**

- 渲染器对**未知 op 直接忽略**（forward-compatible）。这样 agent 和渲染器可独立演进。
- 每条命令**必须幂等**或在 `baseRev` 保护下丢弃过期意图（配合 §3.4）。
- `id` 是稳定标识，渲染器内部映射到 ECS 实体 / scene node。

### 3.4 共识与过期处理

- 渲染器维护 `worldRev`。收到 `baseRev < worldRev` 的意图时，可选择：
  - **应用**（多数命令幂等，安全）；或
  - **丢弃并请求重同步**（对强一致命令，如相机瞬移）。
- 这与 `FrameSlot` 的"只取最新"一致：**过期意图宁可丢，不要排队**，避免延迟累积。

---

## 4. 引擎选型：按「agent 可控制性」而非「画面保真度」

画面保真度是次要维度。对"agent 当导演"这个目标，真正重要的是**引擎的场景是否可以被外部程序声明式、增量化地改写**。

| 引擎 | 场景 = 什么 | Agent 怎么控制 | 契合度 |
|---|---|---|---|
| **three.js / Babylon.js (WebGPU)** | JS 对象树 | agent 输出 JSON → 直接就是场景；产出与场景同构 | 极高（最快闭环） |
| **Bevy (Rust, wgpu)** | ECS 实体/组件 | agent 命令 → 系统 apply 到 entity/component；ECS 天生适合声明式增量 | 极高（与现有 Rust/Tauri 同栈） |
| Godot | 节点树 | GDScript / 外部协议改节点 | 中 |
| Unreal | Actor/组件 | Remote Control API / Python / Pixel Streaming | 低（外部控制逆其设计） |

### 推荐

- **主路：Bevy。** 理由：ECS 的 `spawn / despawn / insert` 就是场景意图原语的天然映射；与现有 `src-tauri`（Rust）、原生播放器、Tauri 主进程同语言，无需跨语言桥；`wgpu` 之上的现代渲染器，含 PBR、bloom、SSAO、TAA 等后处理。
- **旁路：three.js in Tauri webview。** 理由：iterO 最快，agent 输出与 scene graph 同为数据，复用现有 React 前端设施。
- **末期升级：Unreal。** 仅当需要 Nanite/Lumen 级写实且团队具备 UE 能力时，形态为 **UE 渲染 + Pixel Streaming 推流给 Tauri + Remote Control API 接 agent 意图**。在其之前引入只会陷入工具链。

> 反直觉点：Unreal 画面最强，却是"agent 控制"最别扭的选择——它的设计哲学是人在编辑器里搭场景，而非外部程序声明式改场景。

---

## 5. 与现有代码的映射

本方案尽量复用已有设施，而非另起炉灶。

### 5.1 慢回路（已存在，只需扩展）

`agent-controller/agent_stream.py` 已是常驻 agent 进程：

- Rust 侧 `agent.rs` 通过 `stdin/stdout` JSON 行通信（`run_agent_controller` / `agent_controller_input`）。
- 通过 Tauri 事件 `agent-controller-stream` / `-error` / `-exit` 与前端交互。

**扩展点：** 新增一条**出站通道**——agent 产出 `SceneIntent` 后，不再是（或不止是）回聊天，而是写入渲染进程可读的通道。

推荐路径（按现有架构最小改动）：

```
agent_stream.py
   │  print(SceneIntent JSON)            # 复用 stdout 协议
   ▼
Rust agent.rs 读取行 → 识别 scene-intent 前缀
   │
   ▼
写入「最新意图槽」(LatestIntentSlot，语义同 FrameSlot)
   │
   ▼
渲染进程消费
```

### 5.2 快回路（现为 softbuffer，需 3D 化）

`vu_player.rs` 现状：`softbuffer` 是 **2D** CPU blit，**做不了 3D**。因此 3D 化必然强制换成 GPU 渲染器——这一点上"GPU 渲染"的判断是对的，但它是起点不是终点。

**保留不变的部分：**

- `FrameSlot`（只保最新、零阻塞、两端解耦）——整个感知层的范式，继续用。
- 独立的原生全屏进程架构——Bevy 应用同样可作为独立进程启动，`main.rs` 的 `--virtual-universe-player` 分支模式可复用。

**替换的部分：**

- `softbuffer` → `wgpu`（Bevy 自带），采集帧作为**纹理输入**喂进 3D 场景（例如贴到场景中的"传送门/镜面/屏幕"表面）。

### 5.3 意图槽的 Rust 形态（示意）

```rust
/// 与 FrameSlot 同构：只保留最新一份意图，渲染循环永不排队。
struct IntentSlot {
    latest: Mutex<Option<SceneIntent>>,
    rev: AtomicU64,
}

impl IntentSlot {
    fn publish(&self, intent: SceneIntent) { /* replace + rev += 1 */ }
    fn take_latest(&self) -> Option<SceneIntent> { /* take() */ }
    fn rev(&self) -> u64 { self.rev.load(Ordering::SeqCst) }
}
```

渲染循环每帧：

```rust
if slot.rev() != last_applied_rev {
    let intent = slot.take_latest();
    apply_intent(&mut world, intent);   // 确定性应用，可回放
    last_applied_rev = slot.rev();
}
// 其余：动画 / 物理 / 相机插值 / 绘制——与 agent 无关
```

---

## 6. 数据流全景（时序）

```
摄像头帧 ──► L1 感知（FrameSlot）──► L2 世界状态 ──► L3 Agent
                                                        │
                                          SceneIntent ──┘
                                                        │（stdout / IPC）
                                                        ▼
                                              IntentSlot（最新意图）
                                                        │（每帧）
                                                        ▼
                                        L4 渲染器 apply_intent → draw
                                                        │
                                                        ▼
                                                  虚拟世界画面
```

任一层卡顿/崩溃，相邻层按"只取最新 + 超时丢弃"降级，不级联放大延迟。

---

## 7. 落地路线图

| 阶段 | 目标 | 关键交付 | 不做什么 |
|---|---|---|---|
| **P0** | 定死契约 | 本文档 §3 的 SIP schema + 命令词汇表冻结 v0 | 不接真 LLM、不换引擎 |
| **P1** | 最小闭环 | mock agent（规则版）→ SceneIntent → 渲染器 → 画面。Bevy 或 three.js 二选一 | 不做写实、不做感知 |
| **P2** | 接入感知 | L1/L2 打通：摄像头里的人 → 场景里 avatar 位置 | 不做复杂世界模型 |
| **P3** | 接入真实 agent | mock 换成 `agent_stream.py`（本地或云端），扩展词汇表 | 不动渲染层 |
| **P4** | 保真度升级 | 仅当画面不足时评估 UE + Pixel Streaming | 不提前引入 |

**P1 验收标准：** 发一条 `SceneIntent`，场景在 1 帧内反映变化；agent 阻塞 2 秒，画面帧率不下降。这两点过了，架构就立住了。

---

## 8. 关于"写实"与"神经世界模型"

- **写实（Unreal / Nanite / Lumen）**：是 P4 的可选项，不是前置条件。在意图协议跑通前引入 = 被工具链拖住。
- **神经世界模型（Genie 类，直接生成帧）**：不搭显式场景、模型直接产视频。前沿但**不可控、不可回放、难一致**，与"agent 精确控制场景"背道而驰。现阶段不采用；显式 3D 才是可掌控的方向。
- AI 超分 / 神经渲染可后置为渲染管线里的一个 compute pass，`FrameSlot` / `IntentSlot` 两端契约不变。

---

## 9. 待决策项（Open Questions）

1. L4 引擎最终选 **Bevy** 还是 **three.js**？（决定 P1 起点）
2. SceneIntent 的传输用现有 **stdout 协议扩展**，还是引入本地 WebSocket / 共享内存？（决定带宽与语言边界）
3. 世界模型 L2 是**驻留内存的实时状态**，还是**持久化的场景图**（可跨会话）？
4. 现实→虚拟映射的第一批能力：姿态（人在虚拟空间的位置）优先，还是语义（识别物体种类）优先？
5. 是否需要"虚拟→现实"的反馈回路（指令/音频/动作），还是先纯视觉？

---

## 附：命名与术语表

- **Scene Intent（场景意图）**：agent 产出的声明式增量命令序列。
- **IntentSlot（意图槽）**：只保留最新意图的跨回路缓冲，语义同 FrameSlot。
- **Slow Loop / Fast Loop**：编排回路 / 渲染回路。
- **L1–L4**：感知层 / 世界模型层 / 编排层（agent）/ 渲染层。
