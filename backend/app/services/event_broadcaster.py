"""Server-Sent Events (SSE) Broadcaster for Real-Time Event Notifications.

Architecture:
- Asynchronous fan-out publishing to bounded client queues (asyncio.Queue).
- Non-blocking drops for slow/stalled consumers.
- Privacy Guard: Broadcast payloads strictly contain operational metadata
  (type, entity_id, action, timestamp). NO clinical notes, allergies, or personal details.
- SSE Keepalive Heartbeat: Periodic comment frames (: heartbeat) to keep proxies and browsers alive.
"""

import asyncio
from datetime import datetime
import json
from typing import Any, AsyncGenerator, Dict, Optional, Set


class EventBroadcaster:
    """Manages SSE client subscriptions and non-blocking real-time event broadcasting."""

    def __init__(self, heartbeat_interval: float = 15.0):
        self._subscribers: Set[asyncio.Queue] = set()
        self.heartbeat_interval = heartbeat_interval

    @property
    def subscriber_count(self) -> int:
        """Current number of connected clients."""
        return len(self._subscribers)

    async def subscribe(self) -> AsyncGenerator[str, None]:
        """Async generator yielding standard SSE event frames with heartbeat keepalives."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)

        try:
            # 1. Send initial connection confirmation frame
            initial_event = {
                "type": "connected",
                "timestamp": datetime.now().isoformat(),
            }
            yield f"data: {json.dumps(initial_event)}\n\n"

            # 2. Stream subsequent event frames or heartbeats
            while True:
                try:
                    event_data = await asyncio.wait_for(
                        queue.get(), timeout=self.heartbeat_interval
                    )
                    yield f"data: {json.dumps(event_data)}\n\n"
                except asyncio.TimeoutError:
                    # Standard SSE comment keepalive frame
                    yield ": heartbeat\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            # Ensure unregistering on client disconnect or cancellation
            self._subscribers.discard(queue)

    def broadcast(
        self,
        event_type: str,
        entity_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Publish non-sensitive change metadata to all connected subscribers.

        Guarantees non-blocking execution: if a consumer queue is full or blocked,
        it is dropped safely without impeding API route response times.
        """
        payload = {
            "type": event_type,
            "entity_id": entity_id,
            "action": action,
            "timestamp": datetime.now().isoformat(),
        }

        dead_queues = []
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except (asyncio.QueueFull, Exception):
                dead_queues.append(q)

        for dead_q in dead_queues:
            self._subscribers.discard(dead_q)

        return payload


# Global shared singleton broadcaster
broadcaster = EventBroadcaster()
