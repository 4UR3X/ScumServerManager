"""
GET /api/servers/{id}/diagnostics/connection — connection health traffic
light surfaced on the ServerCard LED. v1.0.37j endpoint extracted from
server.py in the v1.0.37k modularisation pass.
"""
from __future__ import annotations

import asyncio
from typing import List

from fastapi import APIRouter, HTTPException

from app_state import db
import scum_process as scum_proc

router = APIRouter()


@router.get("/servers/{server_id}/diagnostics/connection")
async def diagnostics_connection(server_id: str):
    """Three quick checks:
       1. process_alive   — SCUMServer.exe running for this server
       2. query_port_open — A2S_INFO answers on 127.0.0.1:query_port
       3. master_reachable— host can reach Valve's hl2master.steampowered.com

       status: green = all 3 pass, yellow = master unreachable,
               red   = process down OR query silent
    """
    doc = await db.servers.find_one({"id": server_id}, {"_id": 0})
    if doc is None:
        raise HTTPException(status_code=404, detail="Server not found")

    query_port = int(doc.get("query_port") or 7778)
    metrics = scum_proc.get_metrics(server_id, doc.get("folder_path"))
    process_alive = bool(metrics.get("running"))

    query_open = False
    query_open_reason = None
    if process_alive:
        try:
            query_open = await asyncio.to_thread(
                scum_proc._a2s_info_alive, "127.0.0.1", query_port, 1.5,
            )
        except Exception:
            query_open = False

        if not query_open and bool(metrics.get("ready")):
            query_open = True
            query_open_reason = "Log Heartbeat"

    try:
        master = await asyncio.to_thread(scum_proc.check_master_server_reachable, 2.0)
    except Exception as e:
        master = {"ok": False, "host": "hl2master.steampowered.com",
                  "port": 27011, "latency_ms": None, "error": str(e)}

    hints: List[str] = []
    if not process_alive:
        status = "red"
        hints.append("diag_hint_process_down")
    elif not query_open:
        status = "red"
        hints.append("diag_hint_query_silent")
    elif not master.get("ok"):
        status = "yellow"
        hints.append("diag_hint_master_unreachable")
    else:
        status = "green"
        hints.append("diag_hint_all_good")

    return {
        "status": status,
        "checks": {
            "process_alive": {"ok": process_alive, "label": "diag_check_process"},
            "query_port_open": {
                "ok": query_open, "label": "diag_check_query",
                "detail": f"127.0.0.1:{query_port}" + (f" ({query_open_reason})" if query_open_reason else ""),
            },
            "master_reachable": {
                "ok": bool(master.get("ok")),
                "label": "diag_check_master",
                "detail": f"{master.get('host')}:{master.get('port')}",
                "latency_ms": master.get("latency_ms"),
                "error": master.get("error"),
            },
        },
        "hints": hints,
    }
