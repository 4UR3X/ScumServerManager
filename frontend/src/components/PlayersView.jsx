import React, { useEffect, useMemo, useState } from "react";
import {
  Users, Search, RefreshCw, UserCircle2, Shield, Clock, Swords, Coins, Trophy,
  Flag, Car, X, Info, Activity, Wallet, Gem, Timer, UserX, Copy, Check,
  ShieldUser, UserCog, ListChecks, UserCheck, MicOff, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";

const fmtFull = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    // DD.MM.YYYY HH:MM  (admin-requested numeric format)
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yy} ${hh}:${mi}`;
  } catch { return iso; }
};

// DD.MM.YYYY HH:MM — same format used by the recent events list
const fmtShort = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm} ${hh}:${mi}`;
  } catch { return iso; }
};

// Seconds -> "Nd Xh Ym" compact
const fmtDuration = (secs) => {
  if (secs == null || secs <= 0) return "—";
  const s = Math.floor(secs);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}g`);
  if (h) parts.push(`${h}s`);
  if (!d) parts.push(`${m}d`);
  return parts.join(" ") || `${m}d`;
};

// K/D ratio: unlimited deaths -> "inf", 0 deaths -> kills count
const fmtKdRatio = (kills, deaths) => {
  const k = Number(kills) || 0;
  const d = Number(deaths) || 0;
  if (d === 0) return k > 0 ? "∞" : "0.00";
  return (k / d).toFixed(2);
};

const relative = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const PlayersView = ({ servers = [], activeServerId, onSelectServer, onServerUpdated }) => {
  const { t } = useI18n();
  const [serverId, setServerId] = useState(activeServerId || servers[0]?.id || "");
  const [tab, setTab] = useState("online"); // online | all | admins | banned
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ players: [], count: 0, online_count: 0 });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (activeServerId) {
      setServerId(activeServerId);
    }
  }, [activeServerId]);

  useEffect(() => {
    if (servers.length && !servers.find((s) => s.id === serverId)) {
      const nextId = activeServerId || servers[0]?.id || "";
      setServerId(nextId);
    }
  }, [servers, serverId, activeServerId]);

  const load = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      // Always fetch the FULL roster (no `online=` filter) so both tab counts
      // stay accurate when switching between "Online" and "All Players".
      // The tab itself only changes what we render, not what we fetch.
      const params = {};
      if (search) params.search = search;
      const r = await endpoints.listPlayers(serverId, params);
      setData(r);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [serverId, search]);

  useEffect(() => {
    const t = setInterval(() => { load(); }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [serverId, search]);

  const activeServer = useMemo(() => servers.find((s) => s.id === serverId), [servers, serverId]);

  // Client-side tab filter — keeps `data.count` etc. stable across tab switches.
  const visiblePlayers = useMemo(() => {
    const all = data.players || [];
    if (tab === "online") return all.filter((p) => p.is_online);
    if (tab === "admins") return all.filter((p) => p.is_admin_invoker);
    if (tab === "banned") return all.filter((p) => p.is_banned);
    return all;
  }, [data.players, tab]);

  // KPI counts (computed once, reused for tile values and filter feedback)
  const counts = useMemo(() => {
    const all = data.players || [];
    return {
      online: data.online_count ?? all.filter((p) => p.is_online).length,
      total: data.count ?? all.length,
      admins: all.filter((p) => p.is_admin_invoker).length,
      banned: all.filter((p) => p.is_banned).length,
    };
  }, [data]);

  const openDetail = async (player) => {
    try {
      const r = await endpoints.getPlayer(serverId, player.steam_id, 50);
      setDetail(r);
    } catch (_) { /* ignore */ }
  };

  if (!servers.length) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg" data-testid="players-view-empty">
        <div className="text-center text-dim text-sm">Add a server first.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg" data-testid="players-view">
      {/* Header */}
      <div className="bg-bg-deep/80 backdrop-blur-md border-b border-strong px-6 py-4 flex items-center gap-4">
        <Users size={18} className="text-accent-brand" />
        <div>
          <div className="label-accent">{t("nav_players")}</div>
          <div className="heading-stencil text-lg font-semibold">{activeServer?.name || "—"}</div>
        </div>
        <div className="flex-1" />

        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            className="input-field pl-8 text-xs w-56 rounded-xl border-strong focus:border-accent"
            placeholder="Name or SteamID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="players-search"
          />
        </div>

        <button className="icon-btn rounded-xl border border-strong/40 bg-surface/40 p-2 hover:bg-surface/80 transition-all duration-200" onClick={load} title="Refresh" data-testid="players-refresh-btn">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* KPI tiles double as filter buttons — click any tile to filter the
          table below by that category. Active tile gets a brighter accent
          ring + glow. Replaces the old separate "Online / All Players"
          segmented control (which was redundant with the tiles). */}
      <div className="bg-bg-deep/60 backdrop-blur-md border-b border-strong px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          { key: "online", label: t("players_online_tab"), value: counts.online, color: "var(--success)", icon: Activity },
          { key: "all", label: t("players_all_tab"), value: counts.total, color: "var(--accent)", icon: Users },
          { key: "admins", label: t("admin_player") || "Admins", value: counts.admins, color: "var(--warning)", icon: Shield },
          { key: "banned", label: t("cat_users_banned") || "Banned", value: counts.banned, color: "var(--danger)", icon: UserX },
        ].map(({ key, label, value, color, icon: Ico }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              data-testid={`players-kpi-${key}`}
              className="bg-surface/40 border px-4 py-3 flex items-center gap-3.5 relative overflow-hidden text-left rounded-xl transition-all duration-300 hover:bg-surface/70"
              style={{
                borderColor: active ? color : "var(--border)",
                boxShadow: active ? `inset 0 0 0 1px ${color}, 0 0 16px -4px ${color}` : "none",
              }}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1 rounded-r-md"
                style={{ background: color, boxShadow: active ? `0 0 8px ${color}` : "none" }}
              />
              <div
                className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg"
                style={{ background: `color-mix(in srgb, ${color} ${active ? 22 : 12}%, transparent)`, color }}
              >
                <Ico size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] text-dim uppercase tracking-widest truncate">{label}</div>
                <div className="font-display text-lg leading-tight font-bold" style={{ color }}>{value}</div>
              </div>
              {active && (
                <span
                  className="absolute right-3 top-3 text-[9px] font-mono uppercase tracking-widest"
                  style={{ color }}
                >
                  ●
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-bg-deep p-6">
        {visiblePlayers.length === 0 ? (
          <div className="p-12 text-center border border-strong rounded-2xl bg-surface/10">
            <Users size={40} className="mx-auto text-dim mb-4" />
            <h3 className="heading-stencil text-lg mb-2">{t("players_none_title")}</h3>
            <p className="text-xs text-dim max-w-md mx-auto leading-relaxed">{t("players_none_hint")}</p>
          </div>
        ) : (
          <div className="border border-strong rounded-2xl overflow-hidden bg-surface/20 backdrop-blur-md shadow-lg">
            <table className="w-full text-xs font-mono">
              <thead className="bg-bg/95 border-b border-strong sticky top-0 backdrop-blur-md">
                <tr className="text-left">
                  <th className="label-overline px-4 py-3">{t("col_status")}</th>
                  <th className="label-overline px-4 py-3">{t("col_player")}</th>
                  <th className="label-overline px-4 py-3">Steam ID</th>
                  <th className="label-overline px-4 py-3">{t("col_squad")}</th>
                  <th className="label-overline px-4 py-3 text-right">{t("col_fame")}</th>
                  <th className="label-overline px-4 py-3">{t("col_last_seen")}</th>
                  <th className="label-overline px-4 py-3 text-right">{t("col_kills")}</th>
                  <th className="label-overline px-4 py-3 text-right">{t("col_trade")}</th>
                  <th className="label-overline px-4 py-3 text-right">{t("col_flags")}</th>
                  <th className="label-overline px-4 py-3 text-right" title={t("col_vehicles_self_tip")}>{t("col_vehicles_self")}</th>
                  <th className="label-overline px-4 py-3 text-right" title={t("col_vehicles_squad_tip")}>{t("col_vehicles_squad")}</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((p, idx) => (
                  <tr
                    key={p.steam_id}
                    onClick={() => openDetail(p)}
                    data-testid={`player-row-${p.steam_id}`}
                    className={`border-b border-strong/20 hover:bg-accent-soft/20 cursor-pointer transition-colors duration-200 ${idx % 2 === 0 ? "bg-bg-deep/20" : "bg-surface/10"}`}
                  >
                    <td className="px-4 py-3">
                      {p.is_online ? (
                        <span className="flex items-center gap-2 text-success font-semibold">
                          <span className="status-led running shadow-[0_0_8px_var(--success)]" />
                          <span className="text-[10px] uppercase tracking-widest">ONLINE</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-dim">
                          <span className="status-led stopped" />
                          <span className="text-[10px] uppercase tracking-widest">OFFLINE</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-brand font-semibold">{p.name}</span>
                        {p.is_admin_invoker && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-accent-brand/40 text-accent-brand text-[9px] uppercase tracking-widest bg-accent-brand/10 font-bold">
                            <Shield size={8} /> {t("admin_player")}
                          </span>
                        )}
                        {p.is_banned && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-widest font-bold"
                            style={{ color: "var(--danger)", borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}
                          >
                            <UserX size={8} /> {t("cat_users_banned") || "BANNED"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-dim">{p.steam_id}</td>
                    <td className="px-4 py-3 text-dim">{p.squad_name || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.fame > 0 ? "text-warning font-semibold" : "text-dim"}>
                        {p.fame != null ? Number(p.fame).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{fmtFull(p.last_seen)}</div>
                      <div className="text-[10px] text-muted">{relative(p.last_seen)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-brand font-semibold">{p.kills}</span>
                      <span className="text-dim"> / {p.deaths}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-warning font-semibold">
                      {p.trade_amount ? p.trade_amount.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{p.flag_count ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-muted">{p.vehicle_count ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-muted">
                      {p.squad_vehicle_count != null && p.squad_vehicle_count !== p.vehicle_count
                        ? p.squad_vehicle_count
                        : (p.squad_vehicle_count ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info strip: SCUM.db live read status */}
      <div className="bg-surface/80 border-t border-strong px-6 py-3 flex items-center gap-2 text-[10px] text-dim font-mono uppercase tracking-widest">
        <Info size={12} className="text-accent" />
        <span>{t("players_db_source")}</span>
      </div>

      {detail && <PlayerDetailModal detail={detail} allPlayers={data.players} serverId={serverId} onClose={() => setDetail(null)} onUserListChanged={load} onServerUpdated={onServerUpdated} t={t} />}
    </div>
  );
};

/* ---------- Detail modal ---------- */

const DetailStat = ({ icon: Icon, label, value, color }) => (
  <div className="border border-brand/20 bg-bg-deep/40 rounded-xl px-4 py-3 shadow-sm hover:border-brand/40 transition-all duration-200">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={12} style={{ color: color || "var(--text-dim)" }} />
      <span className="label-overline text-[10px] tracking-wider font-semibold text-dim">{label}</span>
    </div>
    <div className="font-mono text-base font-semibold" style={{ color: color || "var(--text)" }}>{value}</div>
  </div>
);

const PlayerDetailModal = ({ detail, allPlayers = [], serverId, onClose, onUserListChanged, onServerUpdated, t }) => {
  const p = detail.player;
  const recent = detail.recent_events || [];
  const [copied, setCopied] = useState(false);
  const [eventsPage, setEventsPage] = useState(0);
  const [confirm, setConfirm] = useState(null); // {action, label, listKey}
  const [busy, setBusy] = useState(false);

  // Events pagination — 5 per page so the modal stays compact and admins
  // can still scrub through long histories without scrolling.
  const EVENTS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(recent.length / EVENTS_PER_PAGE));
  const safePage = Math.min(eventsPage, totalPages - 1);
  const pageEvents = recent.slice(safePage * EVENTS_PER_PAGE, (safePage + 1) * EVENTS_PER_PAGE);

  const copySteamId = async () => {
    try {
      await navigator.clipboard.writeText(p.steam_id);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast.error(String(e.message || e));
    }
  };

  // Quick-action buttons — each one stages a confirmation in `confirm` state.
  // The actual write happens in `runConfirmed()` so the user has one extra
  // "Yes, do it" click protecting them from a misclick that could ban an
  // active admin (or admin-promote a stranger).
  const ACTIONS = [
    { key: "users_admins",        label: t("act_make_admin"),        icon: ShieldUser,  color: "var(--accent)" },
    { key: "users_server_admins", label: t("act_make_server_admin"), icon: UserCog,     color: "var(--accent)" },
    { key: "users_whitelisted",   label: t("act_add_whitelist"),     icon: ListChecks,  color: "var(--success)" },
    { key: "users_exclusive",     label: t("act_add_exclusive"),     icon: UserCheck,   color: "var(--success)" },
    { key: "users_banned",        label: t("act_ban_user"),          icon: UserX,       color: "var(--danger)" },
    { key: "users_silenced",      label: t("act_silence_user"),      icon: MicOff,      color: "var(--warning)" },
  ];

  const runConfirmed = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      const fresh = await endpoints.getServer(serverId);
      const current = fresh?.settings?.[confirm.key] || [];
      if (current.some((u) => String(u.steam_id).trim() === String(p.steam_id).trim())) {
        toast(t("user_already_in_list"));
        setConfirm(null);
        return;
      }
      const newList = [...current, { steam_id: p.steam_id, flags: [], note: `Added from Players (${p.name})` }];
      const updatedServer = await endpoints.updateSettings(serverId, { [confirm.key]: newList });
      toast.success(`${confirm.label} ✓`);
      onUserListChanged?.();
      onServerUpdated?.(updatedServer);
      setConfirm(null);
    } catch (e) {
      toast.error(String(e.response?.data?.detail || e.message || e));
    } finally {
      setBusy(false);
    }
  };

  // Squad mates: all players sharing this squad_id (including the current player).
  // We use squad_id (stable) not squad_name (could collide across SCUM patches).
  const squadMates = useMemo(() => {
    if (!p.squad_id) return [];
    return allPlayers.filter((x) => x.squad_id === p.squad_id);
  }, [allPlayers, p.squad_id]);

  // Squad aggregate totals for the info strip
  const squadAgg = useMemo(() => {
    const zero = { fame: 0, kills: 0, deaths: 0, vehicles: 0, flags: 0, online: 0 };
    return squadMates.reduce((acc, m) => ({
      fame:     acc.fame     + (Number(m.fame) || 0),
      kills:    acc.kills    + (m.kills || 0),
      deaths:   acc.deaths   + (m.deaths || 0),
      vehicles: acc.vehicles + (m.vehicle_count || 0),
      flags:    acc.flags    + (m.flag_count || 0),
      online:   acc.online   + (m.is_online ? 1 : 0),
    }), zero);
  }, [squadMates]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-bg-deep/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="player-detail-modal"
    >
      <div
        className="w-full max-w-3xl bg-surface/90 border border-strong rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="px-6 py-4 border-b border-strong/50 flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center border border-accent-brand/30 bg-accent-soft/20 rounded-xl">
            <UserCircle2 size={20} className="text-accent-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="heading-stencil text-base font-semibold">{p.name}</span>
              {p.is_admin_invoker && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-accent-brand/40 bg-accent-brand/10 text-accent-brand text-[9px] uppercase tracking-widest font-bold">
                  <Shield size={8} /> {t("admin_player")}
                </span>
              )}
              {p.is_online ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-success/40 bg-success/10 text-success text-[9px] uppercase tracking-widest font-bold">
                  <span className="status-led running" /> ONLINE
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[11px] text-dim">{p.steam_id}</span>
              <button
                onClick={copySteamId}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-strong bg-surface/30 text-[10px] text-dim hover:text-accent hover:border-accent transition-all duration-200"
                title={t("copy")}
                data-testid="player-detail-copy-steamid"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn rounded-xl border border-strong/30 bg-surface/20 p-2 hover:bg-surface/80 transition-all duration-200" data-testid="player-detail-close">
            <X size={14} />
          </button>
        </div>

        {/* Quick actions — add this player to any User list in one click. */}
        {serverId && (
          <div className="px-6 py-3 border-b border-strong/30 bg-bg-deep/60 flex items-center gap-2 flex-wrap animate-fade-in" data-testid="player-quick-actions">
            <span className="label-overline text-[9px] tracking-wider text-dim mr-2">{t("quick_actions")}</span>
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                onClick={() => setConfirm(a)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-strong bg-bg/40 hover:bg-accent-soft/60 hover:border-accent-brand/40 text-[11px] font-mono uppercase tracking-wider transition-all duration-200 hover:-translate-y-[1px]"
                style={{ color: a.color }}
                data-testid={`player-action-${a.key}`}
              >
                <a.icon size={11} /> {a.label}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <DetailStat icon={Clock} label={t("col_first_seen")} value={fmtFull(p.first_seen)} />
          <DetailStat icon={Clock} label={t("col_last_seen")} value={fmtFull(p.last_seen)} color="var(--accent)" />
          <DetailStat icon={Timer} label={t("col_playtime")} value={fmtDuration(p.play_time_seconds)} color="var(--accent)" />
          <DetailStat icon={Activity} label={t("col_events")} value={p.total_events} />
          <DetailStat
            icon={Swords}
            label={t("col_kills")}
            value={
              <span>
                {p.kills} / {p.deaths}
                <span className="ml-2 text-[11px] text-dim">({fmtKdRatio(p.kills, p.deaths)})</span>
              </span>
            }
            color={p.kills > p.deaths ? "var(--success)" : "var(--text)"}
          />
          <DetailStat icon={Trophy} label={t("col_fame")} value={p.fame != null ? Number(p.fame).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"} color="var(--warning)" />
          <DetailStat
            icon={Wallet}
            label={t("col_cash")}
            value={p.cash != null ? Number(p.cash).toLocaleString() : "—"}
            color="var(--warning)"
          />
          <DetailStat
            icon={Wallet}
            label={t("col_money")}
            value={p.account_balance != null ? Number(p.account_balance).toLocaleString() : "—"}
            color={p.account_balance != null && p.account_balance < 0 ? "var(--danger)" : "var(--warning)"}
          />
          <DetailStat icon={Gem} label={t("col_gold")} value={p.gold != null ? Number(p.gold).toLocaleString() : "—"} color="var(--accent)" />
          <DetailStat icon={Coins} label={t("col_trade")} value={p.trade_amount ? p.trade_amount.toLocaleString() : "0"} color="var(--warning)" />
          <DetailStat icon={Flag} label={t("col_flags")} value={p.flag_count ?? "—"} />
          <DetailStat icon={Car} label={t("col_vehicles_self")} value={p.vehicle_count ?? "—"} />
        </div>

        {/* Squad aggregate strip — visible only when player belongs to one */}
        {p.squad_name && (
          <div className="mx-6 mb-4 bg-bg-deep/30 border border-accent-brand/20 rounded-xl p-4" data-testid="player-squad-strip">
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} className="text-accent-brand" />
              <span className="label-accent">{t("col_squad")}</span>
              <span className="font-mono text-sm text-brand">{p.squad_name}</span>
              {squadMates.length > 0 && (
                <span className="text-[10px] text-dim uppercase tracking-widest ml-auto font-semibold">
                  {squadMates.length} {t("squad_members")}
                </span>
              )}
            </div>
            {squadMates.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] font-mono">
                <div className="text-dim">
                  <div className="text-[9px] uppercase tracking-widest text-dim/80">{t("squad_total_fame")}</div>
                  <div className="text-warning font-semibold">{squadAgg.fame.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                </div>
                <div className="text-dim">
                  <div className="text-[9px] uppercase tracking-widest text-dim/80">{t("squad_total_kills")}</div>
                  <div className="text-brand font-semibold">{squadAgg.kills}</div>
                </div>
                <div className="text-dim">
                  <div className="text-[9px] uppercase tracking-widest text-dim/80">{t("squad_total_vehicles")}</div>
                  <div className="text-brand font-semibold">{squadAgg.vehicles}</div>
                </div>
                <div className="text-dim">
                  <div className="text-[9px] uppercase tracking-widest text-dim/80">{t("squad_total_flags")}</div>
                  <div className="text-brand font-semibold">{squadAgg.flags}</div>
                </div>
                <div className="text-dim">
                  <div className="text-[9px] uppercase tracking-widest text-dim/80">{t("squad_online")}</div>
                  <div className="text-success font-semibold">{squadAgg.online} / {squadMates.length}</div>
                </div>
                <div className="col-span-full mt-2 border-t border-strong/30 pt-3">
                  <div className="text-[9px] uppercase tracking-widest text-dim mb-1.5">{t("squad_members")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {squadMates.map((m) => (
                      <span
                        key={m.steam_id}
                        className="px-2.5 py-0.5 border text-[10px] rounded-lg transition-colors"
                        style={{
                          borderColor: m.is_online ? "var(--success)" : "var(--border)",
                          color: m.is_online ? "var(--success)" : "var(--text-dim)",
                          background: m.steam_id === p.steam_id ? "rgba(255,132,12,0.1)" : "transparent",
                        }}
                        title={`Fame ${m.fame ?? 0} · K/D ${m.kills}/${m.deaths} · Veh ${m.vehicle_count ?? 0}`}
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-dim">{t("squad_solo")}</div>
            )}
          </div>
        )}

        <div className="px-6 pb-2 border-t border-strong/30 pt-4 flex items-center justify-between">
          <div className="label-accent text-dim">{t("recent_events")} · {recent.length}</div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2" data-testid="events-pagination">
              <button
                onClick={() => setEventsPage((v) => Math.max(0, v - 1))}
                disabled={safePage === 0}
                className="icon-btn rounded-lg border border-strong/30 p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous"
                data-testid="events-page-prev"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="font-mono text-[11px] text-dim">
                {safePage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setEventsPage((v) => Math.min(totalPages - 1, v + 1))}
                disabled={safePage >= totalPages - 1}
                className="icon-btn rounded-lg border border-strong/30 p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next"
                data-testid="events-page-next"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-y-auto scrollbar-thin px-6 pb-6" style={{ maxHeight: "280px" }}>
          {recent.length === 0 ? (
            <div className="text-center py-6 text-dim text-xs">No events recorded.</div>
          ) : pageEvents.map((ev) => (
            <div key={ev.id} className="border-b border-strong/20 py-2.5 flex items-start gap-3 font-mono text-xs hover:bg-surface/5 transition-colors">
              <span className="text-muted text-[10px] tracking-widest pt-0.5 w-32 shrink-0">
                {fmtShort(ev.ts)}
              </span>
              <span className="text-accent-brand w-16 shrink-0 uppercase font-semibold">{ev.type}</span>
              <span className="text-brand flex-1">
                {ev.command || ev.message || ev.item_code || ev.action || ev.weapon || ev.raw?.slice(0, 100) || ""}
              </span>
            </div>
          ))}
        </div>

        {/* Confirmation overlay — explicit double-click protection so an
            admin can't accidentally promote/ban with one click. */}
        {confirm && (
          <div
            className="absolute inset-0 z-10 bg-bg-deep/85 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => !busy && setConfirm(null)}
            data-testid="action-confirm-overlay"
          >
            <div
              className="bg-surface border border-strong rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-bg-deep/40">
                  <confirm.icon size={16} style={{ color: confirm.color }} />
                </div>
                <span className="heading-stencil text-sm font-semibold">{confirm.label}</span>
              </div>
              <p className="text-sm text-brand mb-2">
                <span className="text-dim">{t("confirm_player_action_1")}</span>{" "}
                <span className="font-mono text-accent font-semibold">{p.name}</span>
              </p>
              <p className="text-xs font-mono text-dim mb-4">{p.steam_id}</p>
              <p className="text-xs text-dim mb-6 leading-relaxed">{t("confirm_player_action_2")}</p>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  className="btn-ghost rounded-xl px-4 py-2"
                  onClick={() => setConfirm(null)}
                  disabled={busy}
                  data-testid="action-confirm-no"
                >
                  {t("cancel")}
                </button>
                <button
                  className="btn-primary rounded-xl px-4 py-2 text-white font-semibold transition-all duration-200"
                  onClick={runConfirmed}
                  disabled={busy}
                  data-testid="action-confirm-yes"
                  style={{ background: confirm.color, borderColor: confirm.color }}
                >
                  {busy ? "…" : t("yes_proceed")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
