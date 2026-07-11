"""
Players registry endpoints — aggregate live player data from event log,
SCUM.db, and the per-server banned list. Extracted from server.py
v1.0.37k as part of the modularisation pass.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from app_state import db, logger
import scum_db

router = APIRouter()


@router.get("/servers/{server_id}/players")
async def list_players(server_id: str, online: Optional[bool] = None, search: Optional[str] = None):
    """Aggregate unique players across all ingested events for this server.

    For each steam_id we compute: first_seen, last_seen, last_name (most recent
    display name), is_online (last login event is connect without a subsequent
    disconnect), total event count, admin_flag (has ever executed an admin
    command), fame_delta_total, trade_amount_total, plus per-type event counts.
    """
    pipeline = [
        {"$match": {"server_id": server_id, "steam_id": {"$nin": [None, ""]}}},
        {"$sort": {"ts": 1}},
        {"$group": {
            "_id": "$steam_id",
            "first_seen": {"$first": "$ts"},
            "last_seen": {"$last": "$ts"},
            "last_name": {"$last": "$player_name"},
            "last_action": {"$last": "$action"},
            "last_event_type": {"$last": "$type"},
            "total_events": {"$sum": 1},
            "types": {"$push": "$type"},
            "fame_delta": {"$sum": {"$ifNull": ["$delta", 0]}},
            "trade_amount": {"$sum": {"$cond": [{"$eq": ["$type", "economy"]}, {"$ifNull": ["$amount", 0]}, 0]}},
            "is_admin_invoker": {"$max": {"$cond": [{"$eq": ["$type", "admin"]}, 1, 0]}},
        }},
    ]
    rows = await db.server_events.aggregate(pipeline).to_list(5000)

    # Online-state computed ONLY from login transitions (connect/disconnect) —
    # not any arbitrary "last event". Chatting or killing while online used to
    # flip players to offline.
    login_pipe = [
        {"$match": {"server_id": server_id, "type": "login", "steam_id": {"$nin": [None, ""]}}},
        {"$sort": {"ts": 1}},
        {"$group": {
            "_id": "$steam_id",
            "last_login_action": {"$last": "$action"},
            "last_login_ts": {"$last": "$ts"},
        }},
    ]
    login_state = {r["_id"]: r for r in await db.server_events.aggregate(login_pipe).to_list(5000)}

    STALE_LOGIN_HOURS = 12
    now_dt = datetime.now().replace(tzinfo=timezone.utc)

    kills_pipe = [
        {"$match": {"server_id": server_id, "type": "kill", "killer_steam_id": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$killer_steam_id", "kills": {"$sum": 1}}},
    ]
    kills_map = {r["_id"]: r["kills"] for r in await db.server_events.aggregate(kills_pipe).to_list(5000)}
    deaths_pipe = [
        {"$match": {"server_id": server_id, "type": "kill", "victim_steam_id": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$victim_steam_id", "deaths": {"$sum": 1}}},
    ]
    deaths_map = {r["_id"]: r["deaths"] for r in await db.server_events.aggregate(deaths_pipe).to_list(5000)}

    # SCUM.db enrichment — fame/vehicle/flag/squad come from the live game DB.
    srv_full = await db.servers.find_one({"id": server_id}, {"_id": 0, "folder_path": 1, "settings": 1, "status": 1}) or {}
    db_stats: Dict[str, Dict[str, Any]] = {}
    if srv_full.get("folder_path"):
        try:
            db_stats = await asyncio.to_thread(scum_db.read_player_stats, srv_full["folder_path"])
        except Exception as e:
            logger.info("list_players: SCUM.db read failed (non-fatal): %s", e)

    banned_set: set = set()
    try:
        banned_list = (srv_full.get("settings") or {}).get("users_banned") or []
        for entry in banned_list:
            if isinstance(entry, dict):
                sid_v = str(entry.get("steam_id") or entry.get("sid") or "").strip()
            else:
                sid_v = str(entry).strip().split()[0] if entry else ""
            if sid_v.isdigit() and len(sid_v) == 17:
                banned_set.add(sid_v)
    except Exception:
        pass

    # Latest wallet state per player.
    wallet_pipe = [
        {"$match": {
            "server_id": server_id,
            "steam_id": {"$nin": [None, ""]},
            "type": {"$in": ["balance_snapshot", "currency_conversion", "bank"]},
        }},
        {"$sort": {"ts": 1}},
        {"$group": {
            "_id": "$steam_id",
            "cash_docs":    {"$push": {"ts": "$ts", "v": "$cash"}},
            "bank_docs":    {"$push": {"ts": "$ts", "v": "$account_balance"}},
            "gold_docs":    {"$push": {"ts": "$ts", "v": "$gold"}},
            "last_ts":      {"$last": "$ts"},
        }},
    ]
    raw_wallets = await db.server_events.aggregate(wallet_pipe).to_list(5000)
    balance_map: Dict[str, Dict[str, Any]] = {}
    for r in raw_wallets:
        def _last_nonnull(docs: List[Dict[str, Any]]) -> Optional[int]:
            for d in reversed(docs):
                v = d.get("v")
                if v is not None:
                    return v
            return None
        balance_map[r["_id"]] = {
            "cash": _last_nonnull(r.get("cash_docs") or []),
            "account_balance": _last_nonnull(r.get("bank_docs") or []),
            "gold": _last_nonnull(r.get("gold_docs") or []),
            "balance_ts": r.get("last_ts"),
        }

    server_running = srv_full.get("status") == "Running"

    players: List[Dict[str, Any]] = []
    for r in rows:
        types = r.pop("types", [])
        by_type: Dict[str, int] = {}
        for t in types:
            by_type[t] = by_type.get(t, 0) + 1
        sid = r.pop("_id")
        ls = login_state.get(sid) or {}
        last_login_action = ls.get("last_login_action") or ""
        last_login_ts = ls.get("last_login_ts")
        is_online = last_login_action in ("logged_in", "connected") if server_running else False
        if is_online and last_login_ts:
            try:
                last_login_dt = datetime.fromisoformat(last_login_ts)
                age_h = (now_dt - last_login_dt).total_seconds() / 3600
                if age_h > STALE_LOGIN_HOURS:
                    is_online = False
                
                started_at_str = srv_full.get("started_at")
                if is_online and started_at_str:
                    started_at_dt = datetime.fromisoformat(started_at_str)
                    if last_login_dt < started_at_dt:
                        is_online = False
            except Exception:
                pass
        db_row = db_stats.get(sid) or {}
        bal_row = balance_map.get(sid) or {}
        fame = db_row.get("fame") if db_row.get("fame") is not None else float(r.get("fame_delta") or 0)
        cash_val = bal_row.get("cash") if bal_row.get("cash") is not None else db_row.get("money")
        bank_val = bal_row.get("account_balance")
        gold_val = bal_row.get("gold") if bal_row.get("gold") is not None else db_row.get("gold")
        player = {
            "steam_id": sid,
            "name": db_row.get("db_name") or r.get("last_name") or sid,
            "first_seen": r.get("first_seen"),
            "last_seen": r.get("last_seen"),
            "is_online": is_online,
            "total_events": r.get("total_events", 0),
            "fame": float(fame),
            "fame_delta": int(r.get("fame_delta") or 0),
            "trade_amount": int(r.get("trade_amount") or 0),
            "is_admin_invoker": bool(r.get("is_admin_invoker")),
            "is_banned": sid in banned_set,
            "kills": int(kills_map.get(sid, 0)),
            "deaths": int(deaths_map.get(sid, 0)),
            "by_type": by_type,
            "flag_count": db_row.get("flag_count"),
            "vehicle_count": db_row.get("vehicle_count"),
            "squad_vehicle_count": db_row.get("squad_vehicle_count"),
            "squad_name": db_row.get("squad_name"),
            "squad_id": db_row.get("squad_id"),
            "cash": cash_val,
            "account_balance": bank_val,
            "gold": gold_val,
            "balance_ts": bal_row.get("balance_ts"),
            "money": cash_val,
            "play_time_seconds": db_row.get("play_time_seconds"),
        }
        players.append(player)

    if online is not None:
        players = [p for p in players if p["is_online"] == online]
    if search:
        q = search.lower()
        players = [p for p in players if q in (p["name"] or "").lower() or q in p["steam_id"]]

    players.sort(key=lambda p: (0 if p["is_online"] else 1, p["last_seen"] or ""), reverse=False)
    players.sort(key=lambda p: (0 if p["is_online"] else 1, -(datetime.fromisoformat(p["last_seen"]).timestamp() if p["last_seen"] else 0)))

    return {
        "server_id": server_id,
        "count": len(players),
        "online_count": sum(1 for p in players if p["is_online"]),
        "players": players,
    }


@router.get("/servers/{server_id}/players/{steam_id}")
async def get_player_detail(server_id: str, steam_id: str, limit: int = 50):
    """Return a single player's summary + their last N events."""
    agg = await list_players(server_id, search=steam_id)
    player = next((p for p in agg["players"] if p["steam_id"] == steam_id), None)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found in event history")

    # Fallback play-time from login pairings if SCUM.db didn't expose it.
    if player.get("play_time_seconds") in (None, 0):
        login_events = await db.server_events.find(
            {"server_id": server_id, "type": "login", "steam_id": steam_id},
            {"_id": 0, "ts": 1, "action": 1},
        ).sort("ts", 1).to_list(10000)
        total_secs = 0
        open_ts: Optional[datetime] = None
        for ev in login_events:
            action = (ev.get("action") or "").lower()
            try:
                ts = datetime.fromisoformat(ev["ts"]) if ev.get("ts") else None
            except Exception:
                ts = None
            if not ts:
                continue
            if action in ("logged_in", "connected") and open_ts is None:
                open_ts = ts
            elif action in ("logged_out", "disconnected") and open_ts is not None:
                total_secs += max(0, int((ts - open_ts).total_seconds()))
                open_ts = None
        if open_ts is not None and player.get("is_online"):
            total_secs += max(0, int((datetime.now(timezone.utc) - open_ts).total_seconds()))
        if total_secs > 0:
            player["play_time_seconds"] = total_secs
            player["play_time_source"] = "logs"

    recent = await db.server_events.find(
        {"server_id": server_id, "$or": [{"steam_id": steam_id}, {"killer_steam_id": steam_id}, {"victim_steam_id": steam_id}]},
        {"_id": 0},
    ).sort("ts", -1).limit(max(1, min(int(limit or 50), 200))).to_list(200)
    return {"player": player, "recent_events": recent}
