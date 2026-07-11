"""
SCUM-Manager Discord bot — PER-SERVER architecture (v1.0.37g).

Design notes:
- Each SCUM server has its OWN Discord bot instance (its own token, status
  channel, and event-channel routing). This lets a multi-server admin run
  one community per server (separate guild, separate channels, separate
  identity in Discord).
- Bots are keyed by `server_id` in a module-level `_bots` dict. start_bot()
  is idempotent — calling it again for the same server returns the running
  status without restarting unless the token changed.
- Status channel: the bot keeps ONE embed for ITS server. It uses Discord
  `PartialMessage.edit()` (no `fetch_message`) so missing "Read Message
  History" permission does NOT cause duplicate posts — only Send Messages
  is required.
- Event push: each bot has its own `event_channels` routing table. push_event
  is called with a server_id so the manager fires the embed to the right bot.

Public API (all keyed by server_id):
    await start_bot(server_id, token, get_state_fn, *,
                    status_channel_id=None, message_id_store=None,
                    initial_message_id=None, event_channels=None,
                    server_name=None)
    await stop_bot(server_id)
    get_status(server_id) -> dict
    get_all_statuses() -> dict[server_id, status]
    update_totals(server_id, server_count=1, player_count=N, running_count=N)
    await push_event(server_id, ev, embed_builder) -> bool
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

import discord
from discord import app_commands

log = logging.getLogger("scum_discord")

STATUS_REFRESH_SEC = 60
PRESENCE_REFRESH_SEC = 30


def _fmt_duration(seconds: Optional[int]) -> str:
    if seconds is None or seconds < 0:
        return "—"
    s = int(seconds)
    d, rem = divmod(s, 86400)
    h, rem = divmod(rem, 3600)
    m, _ = divmod(rem, 60)
    if d:
        return f"{d}d {h}h"
    if h:
        return f"{h}h {m}m"
    return f"{m}m"


def _fmt_uptime_long(seconds: Optional[int]) -> str:
    s = int(seconds or 0)
    d, rem = divmod(s, 86400)
    h, rem = divmod(rem, 3600)
    m, _ = divmod(rem, 60)
    return f"{d}D {h}H {m}M"


def _build_server_embed(srv: Dict[str, Any], inst: BotInstance) -> discord.Embed:
    ready = bool(srv.get("ready"))
    name = inst.embed_title or srv.get("name") or srv.get("folder_name") or "SCUM Server"
    max_p = srv.get("max_players") or 64
    players = srv.get("players") or []
    
    color = 0x3BA55C if ready else 0x57606F
    if inst.embed_color and inst.embed_color.strip():
        try:
            hex_val = inst.embed_color.strip().replace("#", "").replace("0x", "")
            color = int(hex_val, 16)
        except Exception:
            pass

    embed = discord.Embed(
        title=name,
        color=color,
        timestamp=datetime.now(timezone.utc),
    )
    if inst.embed_image and inst.embed_image.strip():
        embed.set_thumbnail(url=inst.embed_image.strip())

    embed.add_field(name="👥 Players",
                    value=f"`{len(players)}/{max_p}`", inline=True)
    embed.add_field(name="⌛ Uptime",
                    value=f"`{_fmt_uptime_long(srv.get('uptime_s'))}`" if ready else "`—`",
                    inline=True)
    embed.add_field(name="📡 Status",
                    value=":green_circle: Online" if ready else ":black_circle: Offline",
                    inline=True)

    if ready and players:
        if inst.hide_player_names:
            embed.add_field(
                name="👥 Online Players",
                value=":shield: *PVP Privacy Mode is active. Player details are hidden.*",
                inline=False
            )
        else:
            lines: List[str] = []
            for p in sorted(players, key=lambda x: x.get("duration_s", 0), reverse=True):
                dur = _fmt_duration(p.get("duration_s"))
                squad = p.get("squad")
                squad_tag = f" · `[{squad}]`" if squad else ""
                nm = discord.utils.escape_markdown(p.get("name") or "?")
                lines.append(f"• **{nm}** — `{dur}`{squad_tag}")
            chunk: List[str] = []
            chunk_len = 0
            chunks: List[str] = []
            for line in lines:
                if chunk_len + len(line) + 1 > 1000:
                    chunks.append("\n".join(chunk))
                    chunk = []
                    chunk_len = 0
                chunk.append(line)
                chunk_len += len(line) + 1
            if chunk:
                chunks.append("\n".join(chunk))
            for i, c in enumerate(chunks):
                embed.add_field(
                    name=("👥 Online Players" if i == 0 else "​"),
                    value=c, inline=False,
                )
    elif ready:
        embed.add_field(name="👥 Online Players",
                        value=":x: No players online", inline=False)
    else:
        embed.add_field(name="👥 Online Players",
                        value="*Server is offline*", inline=False)

    footer_text = inst.embed_footer or "Auto-refresh every 60s"
    embed.set_footer(text=footer_text)
    return embed


class ManagerBot(discord.Client):
    """Per-server bot. Knows the server_id it serves so slash commands can
    show that server's data only."""

    def __init__(self, instance: "BotInstance"):
        intents = discord.Intents.default()
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self._instance = instance

    async def setup_hook(self) -> None:
        @self.tree.command(name="online",
                           description="Show who is online on this SCUM server")
        async def online_cmd(interaction: discord.Interaction):
            srv = self._instance.state_fn() if self._instance.state_fn else None
            if not srv:
                await interaction.response.send_message(
                    "No server data available.", ephemeral=True)
                return
            embed = _build_server_embed(srv, self._instance)
            await interaction.response.send_message(embed=embed, ephemeral=True)

        try:
            await self.tree.sync()
        except Exception as e:
            log.info("[%s] slash-command sync skipped: %s",
                     self._instance.server_id, e)

    async def on_ready(self) -> None:
        inst = self._instance
        inst.last_status["connected"] = True
        inst.last_status["user"] = (
            f"{self.user.name}#{self.user.discriminator}" if self.user else None
        )
        inst.last_status["guild_count"] = len(self.guilds)
        log.info("[%s] Discord bot ready as %s (guilds=%d)",
                 inst.server_id, self.user, len(self.guilds))


@dataclass
class BotInstance:
    server_id: str
    server_name: str = ""
    token: str = ""
    client: Optional[ManagerBot] = None
    runner: Optional[asyncio.Task] = None
    presence_task: Optional[asyncio.Task] = None
    status_task: Optional[asyncio.Task] = None
    state_fn: Optional[Callable[[], Dict[str, Any]]] = None
    status_channel_id: Optional[str] = None
    message_id: Optional[str] = None
    msg_id_store: Optional[Callable[[str, str], Awaitable[None]]] = None
    event_channels: Dict[str, Any] = field(default_factory=dict)
    embed_title: Optional[str] = None
    embed_color: Optional[str] = None
    embed_image: Optional[str] = None
    embed_footer: Optional[str] = None
    hide_player_names: bool = False
    last_status: Dict[str, Any] = field(default_factory=lambda: {
        "running": False, "connected": False, "user": None,
        "guild_count": 0, "error": None,
        "totals": {"server_count": 1, "player_count": 0, "running_count": 0},
    })


_bots: Dict[str, BotInstance] = {}


# ----------------------------------------------------------------------------
# Public API — every call is keyed by server_id
# ----------------------------------------------------------------------------

async def start_bot(
    server_id: str,
    token: str,
    get_state_fn: Callable[[], Dict[str, Any]],
    *,
    status_channel_id: Optional[str] = None,
    message_id_store: Optional[Callable[[str, str], Awaitable[None]]] = None,
    initial_message_id: Optional[str] = None,
    event_channels: Optional[Dict[str, Any]] = None,
    server_name: Optional[str] = None,
    embed_title: Optional[str] = None,
    embed_color: Optional[str] = None,
    embed_image: Optional[str] = None,
    embed_footer: Optional[str] = None,
    hide_player_names: Optional[bool] = None,
) -> Dict[str, Any]:
    """Launch (or re-configure) the bot for a specific server. Idempotent."""
    if not token or not token.strip():
        return {"running": False, "connected": False, "error": "empty_token",
                "user": None, "guild_count": 0,
                "totals": {"server_count": 1, "player_count": 0, "running_count": 0}}

    clean_token = token.strip()
    inst = _bots.get(server_id)
    if inst and inst.client and not inst.client.is_closed():
        if clean_token != inst.token:
            await stop_bot(server_id)
            inst = None

    if inst and inst.client and not inst.client.is_closed():
        # Already running. Apply live-updatable settings without a restart.
        inst.state_fn = get_state_fn
        if status_channel_id is not None:
            new_ch = (status_channel_id or "").strip() or None
            if new_ch != inst.status_channel_id:
                inst.status_channel_id = new_ch
                inst.message_id = None  # channel changed -> repost
        if event_channels is not None:
            inst.event_channels = dict(event_channels or {})
        if message_id_store is not None:
            inst.msg_id_store = message_id_store
        if server_name:
            inst.server_name = server_name
        inst.embed_title = embed_title
        inst.embed_color = embed_color
        inst.embed_image = embed_image
        inst.embed_footer = embed_footer
        if hide_player_names is not None:
            inst.hide_player_names = hide_player_names
        return inst.last_status
    elif inst:
        _bots.pop(server_id, None)

    # Cold start
    inst = BotInstance(
        server_id=server_id,
        server_name=server_name or "",
        token=clean_token,
        state_fn=get_state_fn,
        status_channel_id=(status_channel_id or "").strip() or None,
        message_id=(initial_message_id or "").strip() or None,
        msg_id_store=message_id_store,
        event_channels=dict(event_channels or {}),
        embed_title=embed_title,
        embed_color=embed_color,
        embed_image=embed_image,
        embed_footer=embed_footer,
        hide_player_names=bool(hide_player_names),
    )
    inst.client = ManagerBot(inst)
    inst.last_status.update({"running": True, "connected": False, "error": None})
    _bots[server_id] = inst

    async def _run():
        try:
            await inst.client.start(inst.token)
        except discord.LoginFailure:
            inst.last_status["error"] = "login_failed"
            log.warning("[%s] Discord login failed (bad token)", server_id)
        except Exception as e:
            inst.last_status["error"] = f"{type(e).__name__}: {e}"
            log.exception("[%s] Discord bot crashed", server_id)
        finally:
            inst.last_status["running"] = False
            inst.last_status["connected"] = False

    inst.runner = asyncio.create_task(_run(), name=f"scum-discord-bot-{server_id}")
    inst.presence_task = asyncio.create_task(
        _presence_loop(inst), name=f"scum-discord-presence-{server_id}")
    inst.status_task = asyncio.create_task(
        _status_channel_loop(inst), name=f"scum-discord-status-{server_id}")
    return inst.last_status


async def stop_bot(server_id: str) -> Dict[str, Any]:
    inst = _bots.get(server_id)
    if inst is None:
        return {"running": False, "connected": False, "error": None,
                "user": None, "guild_count": 0,
                "totals": {"server_count": 1, "player_count": 0, "running_count": 0}}
    try:
        if inst.client and not inst.client.is_closed():
            await asyncio.wait_for(inst.client.close(), timeout=5.0)
    except Exception as e:
        log.warning("[%s] stop_bot close failed or timed out: %s", server_id, e)
    tasks = [task for task in (inst.status_task, inst.presence_task, inst.runner) if task]
    for task in tasks:
        if task and not task.done():
            task.cancel()
    if tasks:
        try:
            await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=5.0,
            )
        except asyncio.TimeoutError:
            log.warning("[%s] timed out waiting for Discord tasks to stop", server_id)
    inst.last_status["running"] = False
    inst.last_status["connected"] = False
    last = dict(inst.last_status)
    _bots.pop(server_id, None)
    return last


def get_status(server_id: str) -> Dict[str, Any]:
    inst = _bots.get(server_id)
    if inst is None:
        return {"running": False, "connected": False, "error": None,
                "user": None, "guild_count": 0,
                "totals": {"server_count": 1, "player_count": 0, "running_count": 0}}
    running = inst.client is not None and not inst.client.is_closed()
    return {**inst.last_status, "running": running}


def get_all_statuses() -> Dict[str, Dict[str, Any]]:
    return {sid: get_status(sid) for sid in list(_bots.keys())}


def is_running(server_id: str) -> bool:
    inst = _bots.get(server_id)
    return bool(inst and inst.client and not inst.client.is_closed())


def update_totals(server_id: str, *, player_count: int, running: bool) -> None:
    """Update the per-server stats snapshot that the UI panel shows."""
    inst = _bots.get(server_id)
    if inst is None:
        return
    inst.last_status["totals"] = {
        "server_count": 1,
        "player_count": int(player_count),
        "running_count": 1 if running else 0,
    }


async def push_event(
    server_id: str,
    ev: Dict[str, Any],
    embed_builder: Callable[[Dict[str, Any]], discord.Embed],
) -> bool:
    """Route an event embed to this server's configured channel."""
    inst = _bots.get(server_id)
    if inst is None or inst.client is None or inst.client.is_closed():
        return False
    typ = (ev.get("type") or "").lower()
    route = inst.event_channels.get(typ) or {}

    channel_id: Optional[str] = None
    if typ == "chat" and route.get("split_chat"):
        sub = (ev.get("channel") or "").lower()
        for k in ("local", "squad", "global", "admin"):
            if k in sub:
                channel_id = route.get(k)
                break
        if not channel_id:
            channel_id = route.get("channel_id")
    else:
        channel_id = route.get("channel_id")

    if not channel_id:
        return False
    try:
        ch = await _resolve_channel(inst.client, int(channel_id))
        if ch is None:
            return False
        embed = embed_builder(ev)
        await ch.send(embed=embed)
        return True
    except Exception as e:
        log.info("[%s] push_event(%s) failed: %s", server_id, typ, e)
        return False


# ----------------------------------------------------------------------------
# Internal loops
# ----------------------------------------------------------------------------

async def _resolve_channel(client: discord.Client, channel_id: int):
    ch = client.get_channel(channel_id)
    if ch is not None:
        return ch
    try:
        return await client.fetch_channel(channel_id)
    except (discord.NotFound, discord.Forbidden, discord.HTTPException) as e:
        log.info("fetch_channel(%s) failed: %s", channel_id, e)
        return None


async def _presence_loop(inst: BotInstance):
    await asyncio.sleep(3)
    while inst.client is not None and not inst.client.is_closed() and inst.server_id in _bots:
        try:
            srv = inst.state_fn() if inst.state_fn else None
            if srv:
                players = len(srv.get("players") or [])
                name = (srv.get("name") or inst.server_name or "SCUM")[:50]
                ready = bool(srv.get("ready"))
                txt = f"{name} · {players} oyuncu" if ready else f"{name} · offline"
                await inst.client.change_presence(activity=discord.Game(name=txt))
        except Exception as e:
            log.info("[%s] presence update failed: %s", inst.server_id, e)
        await asyncio.sleep(PRESENCE_REFRESH_SEC)


async def _status_channel_loop(inst: BotInstance):
    """Post or edit the per-server status embed. Uses PartialMessage so the
    bot does NOT require Read Message History — only Send Messages."""
    await asyncio.sleep(6)
    while inst.client is not None and not inst.client.is_closed() and inst.server_id in _bots:
        try:
            if inst.status_channel_id and inst.state_fn:
                srv = inst.state_fn()
                if srv:
                    channel = await _resolve_channel(inst.client, int(inst.status_channel_id))
                    if channel is not None:
                        embed = _build_server_embed(srv, inst)
                        sent_id = await _edit_or_send(channel, inst.message_id, embed)
                        if sent_id and sent_id != inst.message_id:
                            inst.message_id = sent_id
                            if inst.msg_id_store:
                                try:
                                    await inst.msg_id_store(inst.server_id, sent_id)
                                except Exception as e:
                                    log.info("[%s] msg_id persist failed: %s",
                                             inst.server_id, e)
        except Exception as e:
            log.info("[%s] status channel loop iteration failed: %s",
                     inst.server_id, e)
        await asyncio.sleep(STATUS_REFRESH_SEC)


async def _edit_or_send(channel, message_id: Optional[str],
                        embed: discord.Embed) -> Optional[str]:
    """Try to edit the previously-posted message in place. We use
    `channel.get_partial_message(id)` + `partial.edit()` so we DON'T need
    Read Message History permission — only Send Messages. If the message
    was deleted (NotFound), we send a new one and return its id."""
    if message_id:
        try:
            partial = channel.get_partial_message(int(message_id))
            await partial.edit(embed=embed)
            return message_id
        except discord.NotFound:
            pass  # message deleted — send a fresh one
        except discord.Forbidden as e:
            log.warning("status edit forbidden: %s", e)
            return message_id  # don't spam new ones on permission errors
        except discord.HTTPException as e:
            log.info("status edit failed (%s); reposting fresh", e)
            # fall through to send a new message
    try:
        msg = await channel.send(embed=embed)
        return str(msg.id)
    except discord.HTTPException as e:
        log.info("status send failed: %s", e)
        return None
