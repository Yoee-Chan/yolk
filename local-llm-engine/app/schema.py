from datetime import datetime, timezone
from enum import Enum
from math import exp, log1p, sqrt, tanh
import re
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import uuid4

from pydantic import BaseModel, Field


class Role(str, Enum):
    """Message role options"""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


ROLE_VALUES = tuple(role.value for role in Role)
ROLE_TYPE = Literal[ROLE_VALUES]  # type: ignore


class ToolChoice(str, Enum):
    """Tool choice options"""

    NONE = "none"
    AUTO = "auto"
    REQUIRED = "required"


TOOL_CHOICE_VALUES = tuple(choice.value for choice in ToolChoice)
TOOL_CHOICE_TYPE = Literal[TOOL_CHOICE_VALUES]  # type: ignore


class AgentState(str, Enum):
    """Agent execution states"""

    IDLE = "IDLE"
    RUNNING = "RUNNING"
    FINISHED = "FINISHED"
    ERROR = "ERROR"


class Function(BaseModel):
    name: str
    arguments: str


class ToolCall(BaseModel):
    """Represents a tool/function call in a message"""

    id: str
    type: str = "function"
    function: Function


class Message(BaseModel):
    """Represents a chat message in the conversation"""

    role: ROLE_TYPE = Field(...)  # type: ignore
    content: Optional[str] = Field(default=None)
    tool_calls: Optional[List[ToolCall]] = Field(default=None)
    name: Optional[str] = Field(default=None)
    tool_call_id: Optional[str] = Field(default=None)
    base64_image: Optional[str] = Field(default=None)

    def __add__(self, other) -> List["Message"]:
        """支持 Message + list 或 Message + Message 的操作"""
        if isinstance(other, list):
            return [self] + other
        elif isinstance(other, Message):
            return [self, other]
        else:
            raise TypeError(
                f"unsupported operand type(s) for +: '{type(self).__name__}' and '{type(other).__name__}'"
            )

    def __radd__(self, other) -> List["Message"]:
        """支持 list + Message 的操作"""
        if isinstance(other, list):
            return other + [self]
        else:
            raise TypeError(
                f"unsupported operand type(s) for +: '{type(other).__name__}' and '{type(self).__name__}'"
            )

    def to_dict(self) -> dict:
        """Convert message to dictionary format"""
        message = {"role": self.role}
        if self.content is not None:
            message["content"] = self.content
        if self.tool_calls is not None:
            message["tool_calls"] = [tool_call.dict() for tool_call in self.tool_calls]
        if self.name is not None:
            message["name"] = self.name
        if self.tool_call_id is not None:
            message["tool_call_id"] = self.tool_call_id
        if self.base64_image is not None:
            message["base64_image"] = self.base64_image
        return message

    @classmethod
    def user_message(
        cls, content: str, base64_image: Optional[str] = None
    ) -> "Message":
        """Create a user message"""
        return cls(role=Role.USER, content=content, base64_image=base64_image)

    @classmethod
    def system_message(cls, content: str) -> "Message":
        """Create a system message"""
        return cls(role=Role.SYSTEM, content=content)

    @classmethod
    def assistant_message(
        cls, content: Optional[str] = None, base64_image: Optional[str] = None
    ) -> "Message":
        """Create an assistant message"""
        return cls(role=Role.ASSISTANT, content=content, base64_image=base64_image)

    @classmethod
    def tool_message(
        cls, content: str, name, tool_call_id: str, base64_image: Optional[str] = None
    ) -> "Message":
        """Create a tool message"""
        return cls(
            role=Role.TOOL,
            content=content,
            name=name,
            tool_call_id=tool_call_id,
            base64_image=base64_image,
        )

    @classmethod
    def from_tool_calls(
        cls,
        tool_calls: List[Any],
        content: Union[str, List[str]] = "",
        base64_image: Optional[str] = None,
        **kwargs,
    ):
        """Create ToolCallsMessage from raw tool calls.

        Args:
            tool_calls: Raw tool calls from LLM
            content: Optional message content
            base64_image: Optional base64 encoded image
        """
        formatted_calls = [
            {"id": call.id, "function": call.function.model_dump(), "type": "function"}
            for call in tool_calls
        ]
        return cls(
            role=Role.ASSISTANT,
            content=content,
            tool_calls=formatted_calls,
            base64_image=base64_image,
            **kwargs,
        )


class MemoryNode(BaseModel):
    """Long-term memory graph node used for selective context recall."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    kind: Literal["topic", "person", "preference", "event", "fact", "episode"] = "fact"
    summary: str
    keywords: List[str] = Field(default_factory=list)
    topics: List[str] = Field(default_factory=list)
    entities: List[str] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    stability: float = Field(default=0.5, ge=0.0, le=1.0)
    access_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    related_ids: List[str] = Field(default_factory=list)


class MemoryEpisode(BaseModel):
    """Compressed short conversation episode."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    summary: str
    key_points: List[str] = Field(default_factory=list)
    message_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MemoryActivation(BaseModel):
    node: MemoryNode
    score: float
    decay: float
    frequency: float
    cue: float
    importance: float
    recency: float
    novelty_penalty: float
    keyword_score: float
    topic_score: float
    entity_score: float


def _tokenize_memory_text(text: str) -> List[str]:
    """Extract mixed Chinese/English cue tokens without external dependencies."""
    return [token.lower() for token in re.findall(r"[\u4e00-\u9fff]{1,}|[a-zA-Z0-9_\-]{2,}", text or "")]


def _overlap_score(query_tokens: List[str], memory_tokens: List[str]) -> float:
    if not query_tokens or not memory_tokens:
        return 0.0
    query_set = set(query_tokens)
    memory_set = set(memory_tokens)
    hits = len(query_set & memory_set)
    return hits / sqrt(len(query_set) * len(memory_set)) if hits else 0.0


def _extract_current_user_message(content: str) -> str:
    """Prefer the real latest user utterance from a composed prompt snapshot."""
    marker = "Current user message:"
    if marker not in content:
        return content.strip()
    return content.rsplit(marker, 1)[-1].strip()


def _extract_user_profile_facts(content: str) -> List[MemoryNode]:
    """Extract durable user profile facts from clean user-facing text."""
    facts: List[MemoryNode] = []
    profile_text = _extract_current_user_message(content)
    if not profile_text:
        return facts

    name_patterns = [
        r"(?:请记住[，,。\s]*)?我叫\s*([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z·._\-]{1,31})",
        r"(?:我的)?名字(?:是|叫)\s*([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z·._\-]{1,31})",
        r"(?:my name is|call me)\s+([A-Za-z][A-Za-z ._\-]{1,63})",
    ]
    for pattern in name_patterns:
        match = re.search(pattern, profile_text, flags=re.IGNORECASE)
        if not match:
            continue
        name = re.split(r"[，,。！？!？\s]", match.group(1).strip(), maxsplit=1)[0]
        if not name:
            continue
        summary = f"用户姓名是{name}。"
        tokens = _tokenize_memory_text(summary + " " + profile_text)
        facts.append(
            MemoryNode(
                kind="person",
                summary=summary,
                keywords=list(dict.fromkeys(tokens + [name]))[:32],
                topics=["用户画像", "姓名"],
                entities=[name],
                attributes={"source_role": "user", "extracted_by": "profile_heuristic", "name": name},
                importance=0.95,
                stability=0.92,
            )
        )
        break

    preference_patterns = [
        ("喜欢", r"我喜欢\s*([^。！？!？\n]{1,80})"),
        ("偏好", r"(?:我的)?偏好(?:是|为)?\s*([^。！？!？\n]{1,80})"),
    ]
    for label, pattern in preference_patterns:
        match = re.search(pattern, profile_text)
        if not match:
            continue
        value = match.group(1).strip(" ，,。")
        if not value:
            continue
        summary = f"用户{label}{value}。"
        tokens = _tokenize_memory_text(summary)
        facts.append(
            MemoryNode(
                kind="preference",
                summary=summary,
                keywords=tokens[:32],
                topics=["用户画像", label],
                entities=[],
                attributes={"source_role": "user", "extracted_by": "profile_heuristic", label: value},
                importance=0.90,
                stability=0.86,
            )
        )
    return facts


class Memory(BaseModel):
    """Hybrid memory store: short window + compressed episodes + long-term graph nodes.

    Context is selected by activation instead of dumping all messages into every LLM
    call. The data structure follows README's EMC idea:
    - messages: raw short-term conversation, trimmed to a safety cap.
    - episodes: compressed rolling summaries every few turns.
    - nodes: durable graph-like memories with cues and related_ids.
    """

    messages: List[Message] = Field(default_factory=list)
    max_messages: int = Field(default=120)
    recent_message_window: int = Field(default=10)
    recall_top_k: int = Field(default=8)
    recall_threshold: float = Field(default=0.06)
    recent_episode_window: int = Field(default=3)
    max_context_chars: int = Field(default=8000)
    decay_lambda: float = Field(default=0.035)
    cue_keyword_weight: float = Field(default=0.50)
    cue_topic_weight: float = Field(default=0.30)
    cue_entity_weight: float = Field(default=0.20)
    nodes: List[MemoryNode] = Field(default_factory=list)
    episodes: List[MemoryEpisode] = Field(default_factory=list)

    def add_message(self, message: Message) -> None:
        """Add a message and distill only useful facts/preferences into memory."""
        self.messages.append(message)
        self._extract_memory_from_message(message)
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages :]

    def add_messages(self, messages: List[Message]) -> None:
        for message in messages:
            self.add_message(message)

    def clear(self) -> None:
        self.messages.clear()
        self.nodes.clear()
        self.episodes.clear()

    def get_recent_messages(self, n: int) -> List[Message]:
        return self.messages[-n:]

    def recall(self, query: str, limit: Optional[int] = None) -> List[MemoryActivation]:
        """Retrieve memories with an adjusted EMC activation curve.

        A = I' * D * F * C * R * N
        I' = 0.70 * importance + 0.30 * stability
        D = exp(-(lambda * (1.15 - stability)) * days_since_access)
        F = 1 + 0.75 * tanh(log(1 + access_count) / 3), bounded frequency boost
        C = alpha*K + beta*T + gamma*E, weighted cue overlap
        R = 0.85 + 0.15 * exp(-days_since_created / 30), gentle recency prior
        N = 1 / sqrt(1 + max(0, duplicate_hits - 1)), duplicate penalty
        """
        query_tokens = _tokenize_memory_text(query)
        now = datetime.now(timezone.utc)
        activations: List[MemoryActivation] = []
        duplicate_count: Dict[str, int] = {}
        for node in self.nodes:
            duplicate_key = re.sub(r"\s+", " ", node.summary.lower()).strip()[:160]
            duplicate_count[duplicate_key] = duplicate_count.get(duplicate_key, 0) + 1

        for node in self.nodes:
            days_access = max((now - node.last_accessed_at).total_seconds() / 86400, 0.0)
            days_created = max((now - node.created_at).total_seconds() / 86400, 0.0)
            importance = 0.70 * node.importance + 0.30 * node.stability
            decay = exp(-(self.decay_lambda * (1.15 - node.stability)) * days_access)
            frequency = 1.0 + 0.75 * tanh(log1p(node.access_count) / 3.0)
            recency = 0.85 + 0.15 * exp(-days_created / 30.0)
            duplicate_key = re.sub(r"\s+", " ", node.summary.lower()).strip()[:160]
            novelty_penalty = 1.0 / sqrt(max(1, duplicate_count.get(duplicate_key, 1)))
            keyword_score = _overlap_score(query_tokens, node.keywords + _tokenize_memory_text(node.summary))
            topic_score = _overlap_score(query_tokens, node.topics)
            entity_score = _overlap_score(query_tokens, node.entities)
            cue = (
                self.cue_keyword_weight * keyword_score
                + self.cue_topic_weight * topic_score
                + self.cue_entity_weight * entity_score
            )
            score = importance * decay * frequency * cue * recency * novelty_penalty
            if score >= self.recall_threshold:
                activations.append(
                    MemoryActivation(
                        node=node,
                        score=score,
                        decay=decay,
                        frequency=frequency,
                        cue=cue,
                        importance=importance,
                        recency=recency,
                        novelty_penalty=novelty_penalty,
                        keyword_score=keyword_score,
                        topic_score=topic_score,
                        entity_score=entity_score,
                    )
                )
        activations.sort(key=lambda item: item.score, reverse=True)
        selected = activations[: limit or self.recall_top_k]
        for activation in selected:
            activation.node.access_count += 1
            activation.node.last_accessed_at = now
        return selected

    def build_context_messages(self, query: str) -> List[Message]:
        """Build selective LLM input: memory summary + recent raw window only."""
        recalled = self.recall(query)
        context_parts: List[str] = []
        if self.episodes:
            recent_episodes = self.episodes[-self.recent_episode_window :]
            episode_lines = [
                f"- {episode.summary}"
                + (f" | key_points={', '.join(episode.key_points[:8])}" if episode.key_points else "")
                for episode in recent_episodes
            ]
            context_parts.append("Recent compressed episodes:\n" + "\n".join(episode_lines))
        if recalled:
            memory_lines = []
            for item in recalled:
                attrs = ", ".join(f"{k}={v}" for k, v in item.node.attributes.items())
                attrs_text = f" attributes: {attrs}" if attrs else ""
                memory_lines.append(
                    f"- [{item.node.kind}] {item.node.summary}{attrs_text} "
                    f"(A={item.score:.3f}, C={item.cue:.3f}, D={item.decay:.3f}, F={item.frequency:.3f})"
                )
            context_parts.append("Recalled long-term memory:\n" + "\n".join(memory_lines))

        context_messages = self.get_recent_messages(self.recent_message_window)
        if context_parts:
            context_text = "Selective memory context. Use it only when relevant; do not assume missing facts.\n" + "\n\n".join(context_parts)
            context_text = context_text[: self.max_context_chars]
            context_messages = [Message.system_message(context_text)] + context_messages
        return context_messages

    def to_dict_list(self) -> List[dict]:
        return [msg.to_dict() for msg in self.messages]

    def _extract_memory_from_message(self, message: Message) -> None:
        """Heuristic extraction for durable memory; raw chat remains short-term only."""
        if not message.content or message.role not in {Role.USER, Role.ASSISTANT}:
            return
        content = message.content.strip()
        clean_content = _extract_current_user_message(content) if message.role == Role.USER else content
        if len(clean_content) < 4:
            return

        for profile_fact in _extract_user_profile_facts(clean_content):
            self._upsert_node(profile_fact)

        tokens = _tokenize_memory_text(clean_content)
        lower = clean_content.lower()
        durable_markers = ["记住", "偏好", "喜欢", "名字", "我叫", "我是", "要求", "规则", "不要", "always", "prefer", "remember", "my name", "call me"]
        task_markers = ["实现", "修复", "补充", "设计", "需求", "公式", "数据结构", "算法", "memory", "上下文"]
        is_durable = len(clean_content) >= 12 and any(marker in lower for marker in durable_markers)
        is_task_topic = len(clean_content) >= 12 and any(marker in lower for marker in task_markers)
        is_episode_boundary = len(self.messages) % 8 == 0

        if is_durable or is_task_topic:
            kind: Literal["topic", "person", "preference", "event", "fact", "episode"] = "topic" if is_task_topic else "preference"
            if any(marker in clean_content for marker in ["名字", "我叫", "我是"]) or any(marker in lower for marker in ["my name", "call me"]):
                kind = "person"
            attributes = {"source_role": message.role, "extracted_by": "heuristic"}
            self._upsert_node(
                MemoryNode(
                    kind=kind,
                    summary=clean_content[:500],
                    keywords=tokens[:32],
                    topics=tokens[:10],
                    entities=[token for token in tokens if token[:1].isupper()][:8],
                    attributes=attributes,
                    importance=0.88 if kind in {"person", "preference"} else 0.68,
                    stability=0.80 if kind in {"person", "preference"} else 0.58,
                )
            )
        if is_episode_boundary:
            recent = [_extract_current_user_message(msg.content or "") for msg in self.get_recent_messages(8) if msg.content]
            summary = " / ".join(text[:90] for text in recent[-4:])
            self.episodes.append(MemoryEpisode(summary=summary[:600], key_points=tokens[:14], message_count=len(recent)))

    def _upsert_node(self, candidate: MemoryNode) -> None:
        """Merge near-duplicate memory nodes instead of growing unbounded duplicates."""
        candidate_tokens = set(candidate.keywords + _tokenize_memory_text(candidate.summary))
        for node in self.nodes:
            if (
                node.kind == candidate.kind == "person"
                and candidate.attributes.get("name")
                and node.attributes.get("name") == candidate.attributes.get("name")
            ):
                node.summary = candidate.summary
                node.keywords = list(dict.fromkeys(node.keywords + candidate.keywords))[:40]
                node.topics = list(dict.fromkeys(node.topics + candidate.topics))[:16]
                node.entities = list(dict.fromkeys(node.entities + candidate.entities))[:16]
                node.importance = min(1.0, max(node.importance, candidate.importance) + 0.03)
                node.stability = min(1.0, max(node.stability, candidate.stability) + 0.02)
                node.access_count += 1
                node.last_accessed_at = datetime.now(timezone.utc)
                node.attributes.update(candidate.attributes)
                return

            node_tokens = set(node.keywords + _tokenize_memory_text(node.summary))
            overlap = len(candidate_tokens & node_tokens) / max(len(candidate_tokens | node_tokens), 1)
            if node.kind == candidate.kind and overlap >= 0.55:
                node.summary = candidate.summary if len(candidate.summary) > len(node.summary) else node.summary
                node.keywords = list(dict.fromkeys(node.keywords + candidate.keywords))[:40]
                node.topics = list(dict.fromkeys(node.topics + candidate.topics))[:16]
                node.entities = list(dict.fromkeys(node.entities + candidate.entities))[:16]
                node.importance = min(1.0, max(node.importance, candidate.importance) + 0.03)
                node.stability = min(1.0, max(node.stability, candidate.stability) + 0.02)
                node.access_count += 1
                node.last_accessed_at = datetime.now(timezone.utc)
                node.attributes.update(candidate.attributes)
                return
        self.nodes.append(candidate)
