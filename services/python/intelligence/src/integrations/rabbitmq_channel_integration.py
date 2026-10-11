import asyncio
import random

import aio_pika
from aio_pika.abc import AbstractChannel, AbstractRobustConnection


def reconnect_delay_seconds(attempt: int) -> float:
    base = min(30.0, 0.5 * float(1 << min(attempt, 6)))
    return base / 2 + random.uniform(0, base / 2)


class RabbitMqChannelProvider:
    def __init__(self, url: str, connection_name: str = "intelligence") -> None:
        self.url = url
        self.connection_name = connection_name
        self.connection: AbstractRobustConnection | None = None
        self.publish_channel: AbstractChannel | None = None
        self.lock = asyncio.Lock()
        self.publish_lock = asyncio.Lock()

    async def connected(self) -> AbstractRobustConnection:
        async with self.lock:
            if self.connection is None or self.connection.is_closed:
                self.connection = await aio_pika.connect_robust(
                    self.url, client_properties={"connection_name": self.connection_name}
                )
            return self.connection

    async def open_channel(self) -> AbstractChannel:
        connection = await self.connected()
        return await connection.channel(publisher_confirms=True, on_return_raises=True)

    async def channel_for_publishing(self) -> AbstractChannel:
        async with self.publish_lock:
            if self.publish_channel is None or self.publish_channel.is_closed:
                self.publish_channel = await self.open_channel()
            return self.publish_channel

    async def close(self) -> None:
        if self.connection is not None and not self.connection.is_closed:
            await self.connection.close()
        self.connection = None
        self.publish_channel = None
