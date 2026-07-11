"""
Remote Server Profiles — v1.0.45.

Persist FTP/FTPS/SFTP credentials for hosted SCUM servers (G-Portal,
PingPerfect, generic providers) and expose CRUD + a Test Connection
endpoint. Passwords are encrypted at rest using Fernet — the key is
derived deterministically from MONGO_URL so it travels with the
deployment without an explicit secret rotation step.

MVP scope (Phase 1):
  POST   /api/remote-servers/test-connection  — credential probe
  POST   /api/remote-servers                  — create
  GET    /api/remote-servers                  — list (passwords masked)
  GET    /api/remote-servers/{id}             — detail (password masked)
  PUT    /api/remote-servers/{id}             — update
  DELETE /api/remote-servers/{id}             — delete
  GET    /api/remote-servers/{id}/listing?path= — browse remote tree

Phase 2 (next turn) will add settings INI read/write, log download, etc.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app_state import db, logger
from services.remote_fs import RemoteFS

router = APIRouter()


# ---------- Password encryption ----------------------------------------------

def _fernet() -> Fernet:
    """Derive a stable Fernet key from MONGO_URL. We don't try to be a
    secret-management system — the threat model is "someone snapshots the
    Mongo database, the passwords should still be useless without the
    deployment's environment". Rotating MONGO_URL invalidates stored
    passwords by design (admin will be prompted to re-enter)."""
    seed = os.environ.get("MONGO_URL", "fallback-seed-for-remote-server-fernet")
    digest = hashlib.sha256(seed.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _enc(plain: str) -> str:
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode()).decode()


def _dec(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        logger.warning("Remote server password could not be decrypted — MONGO_URL likely rotated. Admin must re-enter.")
        return ""


# ---------- Pydantic models --------------------------------------------------

class RemoteServerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    protocol: str = Field(..., pattern="^(ftp|ftps|sftp)$")
    host: str
    port: Optional[int] = None  # defaults: 21 / 21 / 22
    username: str
    password: str
    remote_path: str = "/"  # path TO the SCUM install root on the remote host
    provider_hint: Optional[str] = None  # free-text "G-Portal", "PingPerfect", etc.


class RemoteServerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    protocol: Optional[str] = Field(default=None, pattern="^(ftp|ftps|sftp)$")
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None  # only updated if non-empty
    remote_path: Optional[str] = None
    provider_hint: Optional[str] = None


class TestConnectionPayload(BaseModel):
    protocol: str = Field(..., pattern="^(ftp|ftps|sftp)$")
    host: str
    port: Optional[int] = None
    username: str
    password: str
    remote_path: str = "/"


# ---------- Helpers ----------------------------------------------------------

def _default_port(protocol: str) -> int:
    return 22 if protocol == "sftp" else 21


def _public_view(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Mask password in any document leaving the API."""
    out = {k: v for k, v in doc.items() if k not in ("password_enc", "_id")}
    has_pwd = bool(doc.get("password_enc"))
    out["password_set"] = has_pwd
    return out


def _to_runtime(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Decrypt password for the RemoteFS facade. Internal use only — never
    returned by an endpoint."""
    return {
        **doc,
        "password": _dec(doc.get("password_enc") or ""),
    }


# ---------- Endpoints --------------------------------------------------------

@router.post("/remote-servers/test-connection")
async def test_remote_connection(payload: TestConnectionPayload):
    """Probe the supplied credentials WITHOUT persisting anything. Used by
    the Connect Remote modal so admins iterate on the path until the
    'looks_scumish' check turns true."""
    profile = {
        "protocol": payload.protocol,
        "host": payload.host,
        "port": int(payload.port or _default_port(payload.protocol)),
        "username": payload.username,
        "password": payload.password,
        "remote_path": payload.remote_path or "/",
    }
    result = await asyncio.to_thread(RemoteFS.test_connection, profile)
    return result


@router.post("/remote-servers")
async def create_remote_server(payload: RemoteServerCreate):
    doc = {
        "id": str(uuid.uuid4()),
        "kind": "remote",
        "name": payload.name.strip(),
        "protocol": payload.protocol,
        "host": payload.host.strip(),
        "port": int(payload.port or _default_port(payload.protocol)),
        "username": payload.username.strip(),
        "password_enc": _enc(payload.password),
        "remote_path": (payload.remote_path or "/").rstrip("/") or "/",
        "provider_hint": (payload.provider_hint or "").strip() or None,
        "status": "Connected",  # cosmetic — actual status set by next test
        "last_tested_at": None,
        "last_test_ok": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.remote_servers.insert_one(doc)
    return _public_view(doc)


@router.get("/remote-servers")
async def list_remote_servers():
    docs = await db.remote_servers.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [_public_view(d) for d in docs]


@router.get("/remote-servers/{rid}")
async def get_remote_server(rid: str):
    doc = await db.remote_servers.find_one({"id": rid}, {"_id": 0})
    if doc is None:
        raise HTTPException(404, "Remote server not found")
    return _public_view(doc)


@router.put("/remote-servers/{rid}")
async def update_remote_server(rid: str, payload: RemoteServerUpdate):
    doc = await db.remote_servers.find_one({"id": rid}, {"_id": 0})
    if doc is None:
        raise HTTPException(404, "Remote server not found")
    data = payload.model_dump(exclude_none=True)
    upd: Dict[str, Any] = {}
    if "name" in data: upd["name"] = data["name"].strip()
    if "protocol" in data: upd["protocol"] = data["protocol"]
    if "host" in data: upd["host"] = data["host"].strip()
    if "port" in data: upd["port"] = int(data["port"])
    if "username" in data: upd["username"] = data["username"].strip()
    if "password" in data and data["password"]:
        upd["password_enc"] = _enc(data["password"])
    if "remote_path" in data:
        upd["remote_path"] = (data["remote_path"] or "/").rstrip("/") or "/"
    if "provider_hint" in data:
        upd["provider_hint"] = (data["provider_hint"] or "").strip() or None
    # NOTE: if `upd` ends up empty (e.g. payload was just {password: ""} which
    # is the explicit "preserve-existing-password" case), we deliberately skip
    # update_one and fall through to GET — the stored encrypted credential is
    # preserved and the response reflects the unchanged document.
    if upd:
        await db.remote_servers.update_one({"id": rid}, {"$set": upd})
    return await get_remote_server(rid)


@router.delete("/remote-servers/{rid}")
async def delete_remote_server(rid: str):
    res = await db.remote_servers.delete_one({"id": rid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Remote server not found")
    return {"ok": True}


@router.post("/remote-servers/{rid}/test")
async def test_existing_remote(rid: str):
    """Same as /test-connection but uses the persisted credentials. Updates
    `last_tested_at` / `last_test_ok` on the document."""
    doc = await db.remote_servers.find_one({"id": rid}, {"_id": 0})
    if doc is None:
        raise HTTPException(404, "Remote server not found")
    profile = _to_runtime(doc)
    result = await asyncio.to_thread(RemoteFS.test_connection, profile)
    await db.remote_servers.update_one(
        {"id": rid},
        {"$set": {
            "last_tested_at": datetime.now(timezone.utc).isoformat(),
            "last_test_ok": bool(result.get("ok")),
        }},
    )
    return result


@router.get("/remote-servers/{rid}/listing")
async def list_remote_dir(rid: str, path: Optional[str] = None):
    doc = await db.remote_servers.find_one({"id": rid}, {"_id": 0})
    if doc is None:
        raise HTTPException(404, "Remote server not found")
    profile = _to_runtime(doc)
    target = (path or doc.get("remote_path") or "/").rstrip("/") or "/"
    try:
        entries = await asyncio.to_thread(RemoteFS.list_dir, profile, target)
        return {"path": target, "entries": entries}
    except Exception as e:
        raise HTTPException(502, f"Remote listing failed: {type(e).__name__}: {e}") from e


# ---------- Phase 2: settings INI read/write -------------------------------

@router.post("/remote-servers/{rid}/locate-scum")
async def locate_remote_scum(rid: str):
    """Breadth-first scan of the remote tree for `ServerSettings.ini`. The
    folder containing it becomes this profile's `scum_root_path` and is
    persisted for subsequent settings GETs/PUTs."""
    from services.remote_scum_ops import scan_for_scum_root
    doc = await db.remote_servers.find_one({"id": rid}, {"_id": 0})
    if doc is None:
        raise HTTPException(404, "Remote server not found")
    profile = _to_runtime(doc)
    try:
        found = await asyncio.to_thread(scan_for_scum_root, profile)
    except Exception as e:
        raise HTTPException(502, f"SCUM scan failed: {type(e).__name__}: {e}") from e
    if not found:
        return {"ok": False, "error": "ServerSettings.ini not found within depth=4"}
    await db.remote_servers.update_one(
        {"id": rid}, {"$set": {"scum_root_path": found}},
    )
    return {"ok": True, "scum_root_path": found}


@router.get("/remote-servers/{rid}/settings")
async def read_remote_settings(rid: str):
    """Read + parse the remote SCUM config bundle. Returns the same `settings`
    shape the local server endpoint produces so the React panels can be
    re-used without changes."""
    from services.remote_scum_ops import fetch_settings_to_temp, scan_for_scum_root
    import scum_parser
    import shutil

    doc = await db.remote_servers.find_one({"id": rid}, {"_id": 0})
    if doc is None:
        raise HTTPException(404, "Remote server not found")
    profile = _to_runtime(doc)
    scum_root = doc.get("scum_root_path")
    if not scum_root:
        scum_root = await asyncio.to_thread(scan_for_scum_root, profile)
        if not scum_root:
            raise HTTPException(404, "SCUM folder not located on the remote host. Run /locate-scum first.")
        await db.remote_servers.update_one(
            {"id": rid}, {"$set": {"scum_root_path": scum_root}},
        )
    tmp = await asyncio.to_thread(fetch_settings_to_temp, profile, scum_root)
    try:
        settings = await asyncio.to_thread(scum_parser.parse_real_config_dir, str(tmp))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return {
        "scum_root_path": scum_root,
        "settings": settings,
    }


@router.put("/remote-servers/{rid}/settings")
async def write_remote_settings(rid: str, payload: Dict[str, Any]):
    """Serialize the supplied settings dict back into INI/JSON and upload
    to the remote SCUM root. Payload schema is identical to local server's
    settings PUT (the React panel sends the same shape)."""
    from services.remote_scum_ops import upload_rendered_files
    import scum_parser

    doc = await db.remote_servers.find_one({"id": rid}, {"_id": 0})
    if doc is None:
        raise HTTPException(404, "Remote server not found")
    scum_root = doc.get("scum_root_path")
    if not scum_root:
        raise HTTPException(409, "scum_root_path is not set — call /locate-scum first")
    profile = _to_runtime(doc)

    files: Dict[str, bytes] = {}
    files["ServerSettings.ini"] = scum_parser.render_server_settings_ini(payload).encode("utf-8")
    files["GameUserSettings.ini"] = scum_parser.render_gameusersettings_ini(payload).encode("utf-8")
    files["Input.ini"] = scum_parser.render_input_ini(payload).encode("utf-8")
    files["RaidTimes.json"] = scum_parser.render_raid_times_json(payload).encode("utf-8")
    files["Notifications.json"] = scum_parser.render_notifications_json(payload).encode("utf-8")
    files["EconomyOverride.json"] = scum_parser.render_economy_json(payload).encode("utf-8")
    # User-list files
    for key, fname, force_flag in [
        ("users_admins",       "AdminUsers.ini",       None),
        ("users_server_admins","ServerAdminUsers.ini", "serveradmin"),
        ("users_whitelisted",  "WhitelistedUsers.ini", None),
        ("users_exclusive",    "ExclusiveUsers.ini",   None),
        ("users_banned",       "BannedUsers.ini",      None),
        ("users_silenced",     "SilencedUsers.ini",    None),
    ]:
        entries = payload.get(key) or []
        files[fname] = scum_parser.render_user_list(entries, force_flag=force_flag).encode("utf-8")

    result = await asyncio.to_thread(upload_rendered_files, profile, scum_root, files)
    return {"ok": not result["failed"], **result}
