"""
LGSS SCUM Server Manager — Public Valve Source RCON TCP Client Library
Copyright (c) 2026 Legendary Gaming (4UR3X).

Standalone Python 3.9+ asyncio & synchronous client for communicating with
SCUMServer.exe's Native Source RCON port provisioned by LGSS Manager.
"""
from __future__ import annotations

import asyncio
import re
import socket
import struct
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

SERVERDATA_RESPONSE_VALUE = 0
SERVERDATA_EXECCOMMAND = 2
SERVERDATA_AUTH_RESPONSE = 2
SERVERDATA_AUTH = 3

WORLD_SPAWN_COMMANDS = frozenset({
    "spawnitem",
    "spawnvehicle",
    "spawnanimal",
    "spawnzombie",
    "spawncurrency",
})


@dataclass(frozen=True)
class OnlineScumPlayer:
    name: str
    steam_id: str
    x: float
    y: float
    z: float
    fame: int = 0
    balance: int = 0
    gold: int = 0


def validate_spawn_command_safety(command: str) -> None:
    """Raise ValueError if a world-spawn command omits an explicit Location target."""
    raw = (command or "").strip()
    clean = raw[1:].strip() if raw.startswith("#") else raw
    tokens = clean.split()
    if not tokens:
        raise ValueError("RCON command cannot be empty.")
    verb = tokens[0].lower()
    if verb not in WORLD_SPAWN_COMMANDS:
        return
    if len(tokens) == 2 and tokens[1] == "?":
        return
    for idx, tok in enumerate(tokens[1:], start=1):
        if tok.lower() == "location" and (idx + 1) < len(tokens):
            loc_target = " ".join(tokens[idx + 1 :]).strip().strip('"').strip("'")
            if loc_target:
                return
            break
    raise ValueError(
        f"Target Location is mandatory for #{tokens[0]}. "
        f'Expected: #{tokens[0]} <AssetID> <Qty> Location <SteamID64|"X Y Z">'
    )


def _pack_rcon_frame(request_id: int, packet_type: int, body: str) -> bytes:
    encoded = body.encode("utf-8")
    length = 10 + len(encoded)
    return struct.pack("<iii", length, request_id, packet_type) + encoded + b"\x00\x00"


class LgssSourceRconClient:
    """Synchronous & Asynchronous Valve Source RCON TCP client for SCUM Dedicated Servers."""

    def __init__(self, host: str = "127.0.0.1", port: int = 28015, password: str = "", timeout: float = 8.0) -> None:
        self.host = host
        self.port = int(port)
        self.password = password
        self.timeout = float(timeout)

    def execute(self, command: str) -> str:
        """Execute a single RCON command synchronously with multi-packet sentinel framing."""
        validate_spawn_command_safety(command)
        with socket.create_connection((self.host, self.port), timeout=self.timeout) as sock:
            sock.settimeout(self.timeout)
            sock.sendall(_pack_rcon_frame(10, SERVERDATA_AUTH, self.password))

            authed = False
            for _ in range(3):
                hdr = self._recv_exact(sock, 4)
                (plen,) = struct.unpack("<i", hdr)
                payload = self._recv_exact(sock, plen)
                req_id, ptype = struct.unpack("<ii", payload[:8])
                if ptype == SERVERDATA_AUTH_RESPONSE:
                    if req_id == -1:
                        raise PermissionError("RCON authentication rejected (invalid password).")
                    authed = True
                    break
            if not authed:
                raise ConnectionError("RCON authentication handshake did not complete.")

            cmd_frame = _pack_rcon_frame(20, SERVERDATA_EXECCOMMAND, command.strip())
            sentinel_frame = _pack_rcon_frame(21, SERVERDATA_RESPONSE_VALUE, "")
            sock.sendall(cmd_frame + sentinel_frame)

            chunks: List[str] = []
            while True:
                hdr = self._recv_exact(sock, 4)
                (plen,) = struct.unpack("<i", hdr)
                payload = self._recv_exact(sock, plen)
                req_id, _ = struct.unpack("<ii", payload[:8])
                if req_id == 21:
                    break
                if req_id == 20:
                    chunks.append(payload[8:-2].decode("utf-8", errors="replace"))
            return "".join(chunks).strip()

    async def execute_batch_async(self, commands: Sequence[str]) -> Dict[str, str]:
        """Pipeline multiple commands over a single TCP connection with zero socket churn."""
        clean_cmds = [c.strip() for c in commands if c and c.strip()]
        for cmd in clean_cmds:
            validate_spawn_command_safety(cmd)

        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(self.host, self.port),
            timeout=self.timeout,
        )
        try:
            writer.write(_pack_rcon_frame(10, SERVERDATA_AUTH, self.password))
            await writer.drain()

            while True:
                hdr = await asyncio.wait_for(reader.readexactly(4), timeout=self.timeout)
                (plen,) = struct.unpack("<i", hdr)
                payload = await asyncio.wait_for(reader.readexactly(plen), timeout=self.timeout)
                req_id, ptype = struct.unpack("<ii", payload[:8])
                if ptype == SERVERDATA_AUTH_RESPONSE:
                    if req_id == -1:
                        raise PermissionError("RCON authentication rejected.")
                    break

            sentinel_id = 999999
            buf = bytearray()
            for idx, cmd in enumerate(clean_cmds):
                buf += _pack_rcon_frame(100 + idx, SERVERDATA_EXECCOMMAND, cmd)
            buf += _pack_rcon_frame(sentinel_id, SERVERDATA_RESPONSE_VALUE, "")
            writer.write(bytes(buf))
            await writer.drain()

            buckets: Dict[int, List[str]] = {100 + i: [] for i in range(len(clean_cmds))}
            while True:
                hdr = await asyncio.wait_for(reader.readexactly(4), timeout=self.timeout)
                (plen,) = struct.unpack("<i", hdr)
                payload = await asyncio.wait_for(reader.readexactly(plen), timeout=self.timeout)
                req_id, _ = struct.unpack("<ii", payload[:8])
                if req_id == sentinel_id:
                    break
                if req_id in buckets:
                    buckets[req_id].append(payload[8:-2].decode("utf-8", errors="replace"))

            return {cmd: "".join(buckets[100 + i]).strip() for i, cmd in enumerate(clean_cmds)}
        finally:
            writer.close()
            await writer.wait_closed()

    def list_players(self) -> List[OnlineScumPlayer]:
        """Query `#ListPlayers` and parse structured online player records."""
        raw = self.execute("#ListPlayers")
        players: List[OnlineScumPlayer] = []
        blocks = re.split(r"(?=^\d+\.\s+)", raw, flags=re.MULTILINE)
        loc_re = re.compile(r"X=([-+]?\d+(?:\.\d+)?)\s+Y=([-+]?\d+(?:\.\d+)?)\s+Z=([-+]?\d+(?:\.\d+)?)", re.I)
        for blk in blocks:
            lines = [ln.strip() for ln in blk.splitlines() if ln.strip()]
            if not lines or not re.match(r"^\d+\.\s+", lines[0]):
                continue
            name = re.sub(r"^\d+\.\s+", "", lines[0]).strip()
            sid = ""
            x = y = z = 0.0
            fame = balance = gold = 0
            for ln in lines[1:]:
                low = ln.lower()
                if low.startswith("steam id:") or low.startswith("platform id:"):
                    m = re.search(r"(\d{15,20})", ln)
                    sid = m.group(1) if m else ""
                elif low.startswith("fame:"):
                    fame = int(float(ln.split(":", 1)[1].strip() or 0))
                elif low.startswith("account balance:"):
                    balance = int(float(ln.split(":", 1)[1].strip() or 0))
                elif low.startswith("gold balance:"):
                    gold = int(float(ln.split(":", 1)[1].strip() or 0))
                elif "x=" in low and "y=" in low:
                    ml = loc_re.search(ln)
                    if ml:
                        x, y, z = float(ml.group(1)), float(ml.group(2)), float(ml.group(3))
            if sid:
                players.append(OnlineScumPlayer(name=name, steam_id=sid, x=x, y=y, z=z, fame=fame, balance=balance, gold=gold))
        return players

    @staticmethod
    def _recv_exact(sock: socket.socket, count: int) -> bytes:
        out = bytearray()
        while len(out) < count:
            chunk = sock.recv(count - len(out))
            if not chunk:
                raise ConnectionError("Socket closed unexpectedly by RCON peer.")
            out.extend(chunk)
        return bytes(out)
