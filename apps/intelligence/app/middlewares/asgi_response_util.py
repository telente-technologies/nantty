import json

from starlette.types import Send


async def send_json_error_response(
    send: Send, status_code: int, error_code: str, extra_headers: list[tuple[bytes, bytes]] | None = None
) -> None:
    body = json.dumps({"error": {"code": error_code}}, separators=(",", ":")).encode("utf-8")
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(body)).encode("ascii")),
        (b"cache-control", b"no-store"),
        *(extra_headers or []),
    ]
    await send({"type": "http.response.start", "status": status_code, "headers": headers})
    await send({"type": "http.response.body", "body": body, "more_body": False})


def read_header_value(raw_headers: list[tuple[bytes, bytes]], header_name: bytes) -> str | None:
    for raw_name, raw_value in raw_headers:
        if raw_name.lower() == header_name:
            try:
                return raw_value.decode("latin-1")
            except UnicodeDecodeError:
                return None
    return None
