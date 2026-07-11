"""
Remote-server filesystem service (v1.0.45 — Remote Hosted Servers).

Single thin facade over FTP / FTPS / SFTP so the rest of the codebase
just calls open_remote(profile).list("/") / .read("path") / .write(...).
Connection objects are short-lived (open per operation) — keeps things
robust against idle disconnects from G-Portal / PingPerfect style hosts
that aggressively close FTP control channels after ~60s.

Public API:
    RemoteFS.test_connection(profile) -> dict
    RemoteFS.list_dir(profile, path) -> list[FileEntry]
    RemoteFS.read_text(profile, path, encoding="utf-8") -> str
    RemoteFS.read_bytes(profile, path) -> bytes
    RemoteFS.write_text(profile, path, text, encoding="utf-8") -> None
    RemoteFS.write_bytes(profile, path, data) -> None
    RemoteFS.stat(profile, path) -> dict

`profile` is the dict form of `RemoteServerProfile` (id, protocol, host,
port, username, password, remote_path).
"""
from __future__ import annotations

import io
import logging
import ssl
from dataclasses import dataclass
from ftplib import FTP, FTP_TLS, error_perm
from typing import Any, Dict, List, Optional

try:
    import paramiko  # type: ignore
    _HAS_PARAMIKO = True
except Exception:
    paramiko = None  # type: ignore
    _HAS_PARAMIKO = False

log = logging.getLogger("scum_remote_fs")

CONNECT_TIMEOUT = 8  # seconds — fast feedback for the Test Connection button


@dataclass
class FileEntry:
    name: str
    path: str
    is_dir: bool
    size: int = 0
    mtime_iso: Optional[str] = None


# ---------------------------------------------------------------------------
# FTP / FTPS helpers
# ---------------------------------------------------------------------------

def _open_ftp(profile: Dict[str, Any]):
    proto = (profile.get("protocol") or "ftp").lower()
    host = profile["host"]
    port = int(profile.get("port") or 21)
    user = profile.get("username") or "anonymous"
    pwd = profile.get("password") or ""

    if proto == "ftps":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE  # game-host certs are routinely self-signed
        ftp = FTP_TLS(context=ctx, timeout=CONNECT_TIMEOUT)
        ftp.connect(host, port, timeout=CONNECT_TIMEOUT)
        ftp.login(user, pwd)
        ftp.prot_p()  # encrypt the data channel too
    else:
        ftp = FTP(timeout=CONNECT_TIMEOUT)
        ftp.connect(host, port, timeout=CONNECT_TIMEOUT)
        ftp.login(user, pwd)
    # Passive mode — required when the manager runs behind NAT (which is
    # 99% of admin laptops).
    ftp.set_pasv(True)
    return ftp


def _ftp_list(profile: Dict[str, Any], path: str) -> List[FileEntry]:
    out: List[FileEntry] = []
    with _open_ftp(profile) as ftp:
        # Prefer MLSD (typed) — falls back to LIST + heuristic parsing.
        try:
            for name, facts in ftp.mlsd(path):
                if name in (".", ".."):
                    continue
                is_dir = (facts.get("type") or "") == "dir"
                size = int(facts.get("size") or 0)
                mtime = facts.get("modify")
                mtime_iso = (
                    f"{mtime[:4]}-{mtime[4:6]}-{mtime[6:8]}T{mtime[8:10]}:{mtime[10:12]}:{mtime[12:14]}Z"
                    if mtime and len(mtime) >= 14 else None
                )
                full = f"{path.rstrip('/')}/{name}" if path != "/" else f"/{name}"
                out.append(FileEntry(name=name, path=full, is_dir=is_dir, size=size, mtime_iso=mtime_iso))
        except error_perm:
            # Old server with no MLSD support — fall back to LIST.
            lines: List[str] = []
            ftp.retrlines(f"LIST {path}", lines.append)
            for line in lines:
                parts = line.split(None, 8)
                if len(parts) < 9:
                    continue
                perms, _, _, _, size_s, _, _, _, name = parts
                if name in (".", ".."):
                    continue
                full = f"{path.rstrip('/')}/{name}" if path != "/" else f"/{name}"
                out.append(FileEntry(
                    name=name, path=full,
                    is_dir=perms.startswith("d"),
                    size=int(size_s) if size_s.isdigit() else 0,
                ))
    return out


def _ftp_read(profile: Dict[str, Any], path: str) -> bytes:
    buf = io.BytesIO()
    with _open_ftp(profile) as ftp:
        ftp.retrbinary(f"RETR {path}", buf.write)
    return buf.getvalue()


def _ftp_write(profile: Dict[str, Any], path: str, data: bytes) -> None:
    with _open_ftp(profile) as ftp:
        ftp.storbinary(f"STOR {path}", io.BytesIO(data))


def _ftp_stat(profile: Dict[str, Any], path: str) -> Dict[str, Any]:
    """Cheap stat: SIZE for size, MDTM for mtime."""
    out: Dict[str, Any] = {"path": path}
    with _open_ftp(profile) as ftp:
        try:
            out["size"] = ftp.size(path)
        except Exception:
            out["size"] = None
        try:
            resp = ftp.sendcmd(f"MDTM {path}")
            mtime = resp.split()[-1]
            if mtime and len(mtime) >= 14:
                out["mtime_iso"] = (
                    f"{mtime[:4]}-{mtime[4:6]}-{mtime[6:8]}T{mtime[8:10]}:{mtime[10:12]}:{mtime[12:14]}Z"
                )
        except Exception:
            out["mtime_iso"] = None
    return out


# ---------------------------------------------------------------------------
# SFTP helpers (paramiko)
# ---------------------------------------------------------------------------

class _SFTPSession:
    def __init__(self, profile: Dict[str, Any]):
        if not _HAS_PARAMIKO:
            raise RuntimeError("paramiko is required for SFTP; install paramiko")
        self.transport = paramiko.Transport((profile["host"], int(profile.get("port") or 22)))
        self.transport.banner_timeout = CONNECT_TIMEOUT
        self.transport.connect(
            username=profile.get("username") or "",
            password=profile.get("password") or "",
        )
        self.sftp = paramiko.SFTPClient.from_transport(self.transport)

    def close(self):
        try: self.sftp.close()
        except Exception: pass
        try: self.transport.close()
        except Exception: pass

    def __enter__(self): return self
    def __exit__(self, *a): self.close()


def _sftp_list(profile: Dict[str, Any], path: str) -> List[FileEntry]:
    import stat as st
    out: List[FileEntry] = []
    with _SFTPSession(profile) as s:
        for attr in s.sftp.listdir_attr(path or "/"):
            full = f"{path.rstrip('/')}/{attr.filename}" if path and path != "/" else f"/{attr.filename}"
            out.append(FileEntry(
                name=attr.filename,
                path=full,
                is_dir=st.S_ISDIR(attr.st_mode or 0),
                size=int(attr.st_size or 0),
                mtime_iso=None,  # left as None — UI doesn't need it in MVP
            ))
    return out


def _sftp_read(profile: Dict[str, Any], path: str) -> bytes:
    with _SFTPSession(profile) as s, s.sftp.open(path, "rb") as f:
        return f.read()


def _sftp_write(profile: Dict[str, Any], path: str, data: bytes) -> None:
    with _SFTPSession(profile) as s, s.sftp.open(path, "wb") as f:
        f.write(data)


def _sftp_stat(profile: Dict[str, Any], path: str) -> Dict[str, Any]:
    with _SFTPSession(profile) as s:
        attr = s.sftp.stat(path)
        return {
            "path": path,
            "size": int(attr.st_size or 0),
            "mtime_iso": None,  # paramiko returns epoch; UI doesn't need it now
        }


# ---------------------------------------------------------------------------
# Public facade
# ---------------------------------------------------------------------------

class RemoteFS:

    @staticmethod
    def test_connection(profile: Dict[str, Any]) -> Dict[str, Any]:
        """Smoke-test: connect + list the configured remote_path.
           Returns {ok: bool, error?: str, listing_sample: [first 5 entries]}."""
        path = (profile.get("remote_path") or "/").rstrip("/") or "/"
        proto = (profile.get("protocol") or "ftp").lower()
        try:
            if proto == "sftp":
                entries = _sftp_list(profile, path)
            else:
                entries = _ftp_list(profile, path)
            sample = [
                {"name": e.name, "is_dir": e.is_dir, "size": e.size}
                for e in entries[:5]
            ]
            # Heuristic — at least ONE of these names should be present in a
            # real SCUM dedicated server directory. If none match we warn the
            # admin that the path probably points to the wrong folder.
            wants = {"scum.exe", "scumserver.exe", "scum", "SCUM"}
            sees = {e.name for e in entries}
            looks_scumish = bool(wants & sees) or any(n.lower() == "scum" for n in sees)
            return {
                "ok": True,
                "listing_sample": sample,
                "looks_scumish": looks_scumish,
                "entry_count": len(entries),
            }
        except Exception as e:
            return {"ok": False, "error": f"{type(e).__name__}: {e}"}

    @staticmethod
    def list_dir(profile: Dict[str, Any], path: str) -> List[Dict[str, Any]]:
        proto = (profile.get("protocol") or "ftp").lower()
        entries = _sftp_list(profile, path) if proto == "sftp" else _ftp_list(profile, path)
        return [
            {"name": e.name, "path": e.path, "is_dir": e.is_dir,
             "size": e.size, "mtime_iso": e.mtime_iso}
            for e in entries
        ]

    @staticmethod
    def read_bytes(profile: Dict[str, Any], path: str) -> bytes:
        proto = (profile.get("protocol") or "ftp").lower()
        return _sftp_read(profile, path) if proto == "sftp" else _ftp_read(profile, path)

    @staticmethod
    def read_text(profile: Dict[str, Any], path: str, encoding: str = "utf-8") -> str:
        return RemoteFS.read_bytes(profile, path).decode(encoding, errors="replace")

    @staticmethod
    def write_bytes(profile: Dict[str, Any], path: str, data: bytes) -> None:
        proto = (profile.get("protocol") or "ftp").lower()
        if proto == "sftp":
            _sftp_write(profile, path, data)
        else:
            _ftp_write(profile, path, data)

    @staticmethod
    def write_text(profile: Dict[str, Any], path: str, text: str, encoding: str = "utf-8") -> None:
        RemoteFS.write_bytes(profile, path, text.encode(encoding))

    @staticmethod
    def stat(profile: Dict[str, Any], path: str) -> Dict[str, Any]:
        proto = (profile.get("protocol") or "ftp").lower()
        return _sftp_stat(profile, path) if proto == "sftp" else _ftp_stat(profile, path)
