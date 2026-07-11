"""
Remote SCUM operations — Phase 2 helpers used by routes/remote_servers.py.

`scan_for_scum_root(profile, max_depth=3)`
    Walk the remote tree starting at `profile["remote_path"]` and find the
    folder that contains ServerSettings.ini (the canonical SCUM dedicated
    server root). Returns the absolute remote path or None.

`fetch_settings_to_temp(profile, scum_root)`
    Download the standard SCUM config bundle (ServerSettings.ini,
    GameUserSettings.ini, Input.ini, economy/*.json, user-list files,
    Notifications.json, RaidTimes.json) into a fresh temp dir and return
    the temp dir path. Caller is responsible for cleanup.

`upload_rendered_files(profile, scum_root, files)`
    Upload a dict of {remote_relative_path: bytes} back to the remote host.
"""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from services.remote_fs import RemoteFS

log = logging.getLogger("scum_remote_ops")

# Files we care about for the Settings panel. Same names the local
# `scum_parser.parse_real_config_dir` expects.
SCUM_CONFIG_FILES: Set[str] = {
    "ServerSettings.ini",
    "GameUserSettings.ini",
    "Input.ini",
    "EconomyOverride.json",
    "RaidTimes.json",
    "Notifications.json",
    "AdminUsers.ini",
    "ServerAdminUsers.ini",
    "WhitelistedUsers.ini",
    "ExclusiveUsers.ini",
    "BannedUsers.ini",
    "SilencedUsers.ini",
}


def scan_for_scum_root(profile: Dict[str, Any], max_depth: int = 4) -> Optional[str]:
    """Breadth-first walk capped at `max_depth`. The first directory whose
    listing contains `ServerSettings.ini` is the SCUM root.

    Common SCUM dedicated-server layouts the scan covers:
       /ServerSettings.ini                       (root install)
       /scum/SCUM/Saved/Config/...              (G-Portal)
       /server/SCUM/Saved/Config/WindowsServer/ (PingPerfect)
    """
    start = (profile.get("remote_path") or "/").rstrip("/") or "/"
    queue: List[tuple] = [(start, 0)]
    visited: Set[str] = set()
    while queue:
        path, depth = queue.pop(0)
        if path in visited or depth > max_depth:
            continue
        visited.add(path)
        try:
            entries = RemoteFS.list_dir(profile, path)
        except Exception as e:
            log.info("scan: list_dir(%s) failed: %s", path, e)
            continue
        names = {e["name"] for e in entries}
        if "ServerSettings.ini" in names:
            return path
        # Queue subdirs only — files don't help us recurse.
        for e in entries:
            if e["is_dir"] and not e["name"].startswith("."):
                sub = e["path"]
                if sub not in visited:
                    queue.append((sub, depth + 1))
    return None


def fetch_settings_to_temp(profile: Dict[str, Any], scum_root: str) -> Path:
    """Download all known SCUM config files into a fresh tempdir mirroring
    the local on-disk layout `scum_parser.parse_real_config_dir` expects.

    For the MVP we flatten every config into the SAME folder (the parser
    walks recursively but tolerates a flat dir for the common files). If a
    file is missing on the remote host we just skip it — the parser falls
    back to defaults exactly as it does for fresh local installs.
    """
    tmp = Path(tempfile.mkdtemp(prefix="scum-remote-cfg-"))
    try:
        entries = RemoteFS.list_dir(profile, scum_root)
    except Exception as e:
        log.warning("fetch_settings: list_dir(%s) failed: %s", scum_root, e)
        return tmp

    pulled = 0
    for e in entries:
        if e["is_dir"]:
            continue
        if e["name"] not in SCUM_CONFIG_FILES:
            continue
        try:
            data = RemoteFS.read_bytes(profile, e["path"])
            (tmp / e["name"]).write_bytes(data)
            pulled += 1
        except Exception as ex:
            log.info("fetch_settings: read_bytes(%s) failed: %s", e["path"], ex)
    log.info("fetch_settings: pulled %d files into %s", pulled, tmp)
    return tmp


def upload_rendered_files(profile: Dict[str, Any], scum_root: str,
                          files: Dict[str, bytes]) -> Dict[str, Any]:
    """Push the rendered config bytes back to the remote SCUM root.

    `files` keys are bare filenames (no path) — the function joins each
    onto `scum_root`. Returns {written: [...], failed: [{name, error}]}
    so the UI can show partial success.
    """
    written: List[str] = []
    failed: List[Dict[str, str]] = []
    for name, data in files.items():
        remote_full = f"{scum_root.rstrip('/')}/{name}"
        try:
            RemoteFS.write_bytes(profile, remote_full, data)
            written.append(name)
        except Exception as e:
            failed.append({"name": name, "error": f"{type(e).__name__}: {e}"})
    return {"written": written, "failed": failed}
