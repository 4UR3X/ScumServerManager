import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollText, FolderSearch, Trash2, Search, RefreshCw, Users,
  Wrench, MessageCircle, LogIn, Swords, Coins, AlertTriangle, Trophy,
  ShieldCheck, FileText, Car, Key, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";

/* ─── Category meta ────────────────────────────────────────────────────── */
const TYPE_META = {
  admin:               { icon: Wrench,        color: "var(--accent)",   labelKey: "event_type_admin" },
  chat:                { icon: MessageCircle, color: "var(--info)",     labelKey: "event_type_chat" },
  login:               { icon: LogIn,         color: "var(--success)",  labelKey: "event_type_login" },
  kill:                { icon: Swords,        color: "var(--danger)",   labelKey: "event_type_kill" },
  economy:             { icon: Coins,         color: "var(--warning)",  labelKey: "event_type_economy" },
  violation:           { icon: AlertTriangle, color: "var(--danger)",   labelKey: "event_type_violation" },
  fame:                { icon: Trophy,        color: "#A78BFA",         labelKey: "event_type_fame" },
  raid:                { icon: ShieldCheck,   color: "#78909C",         labelKey: "event_type_raid" },
  vehicle_destruction: { icon: Car,           color: "#FF6B4A",         labelKey: "event_type_vehicle_destruction" },
  vehicle_claim:       { icon: Key,           color: "#22D36F",         labelKey: "event_type_vehicle_claim" },
  generic:             { icon: FileText,      color: "var(--text-dim)", labelKey: "event_type_generic" },
};

/* ─── Timestamp format ──────────────────────────────────────────────────── */
const fmtTs = (iso) => {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  } catch { return iso; }
};

/* ─── EventRow ──────────────────────────────────────────────────────────── */
const EventRow = ({ ev }) => {
  const meta = TYPE_META[ev.type] || TYPE_META.generic;
  const Icon = meta.icon;

  const renderBody = () => {
    switch (ev.type) {
      case "admin":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name || "system"}</span>
            <span className="text-muted"> ran </span>
            <span className="font-mono text-accent-brand">{ev.command}</span>
            {ev.args && <span className="font-mono text-dim"> {ev.args}</span>}
          </>
        );
      case "chat":
        return (
          <>
            <span className="text-muted font-mono text-[10px]">[{ev.channel}]</span>
            <span className="text-brand font-semibold"> {ev.player_name}</span>
            <span className="text-muted">: </span>
            <span className="text-brand">{ev.message}</span>
          </>
        );
      case "login":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name}</span>
            <span style={{ color: ev.action?.includes("out") || ev.action?.includes("disconnect") ? "var(--danger)" : "var(--success)" }}>
              {" "}{ev.action?.replace("_", " ")}
            </span>
          </>
        );
      case "kill":
        return (
          <>
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>{ev.killer_name}</span>
            <span className="text-muted"> killed </span>
            <span className="text-brand font-semibold">{ev.victim_name}</span>
            <span className="text-muted"> · </span>
            <span className="font-mono text-accent-brand" style={{ fontSize: 10 }}>{ev.weapon}</span>
            <span className="text-muted font-mono"> · {Math.round(ev.distance_m || 0)}m</span>
          </>
        );
      case "economy":
      case "bank":
      case "currency_conversion":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name}</span>
            <span className="text-muted"> {ev.action || "interacted"} </span>
            {ev.item_code ? (
              <span className="font-mono text-accent-brand">{ev.quantity}× {ev.item_code}</span>
            ) : ev.credit_qty ? (
              <span className="font-mono text-accent-brand">{ev.credit_qty} credits</span>
            ) : ev.gross_amount ? (
              <span className="font-mono text-accent-brand">{ev.gross_amount} credits</span>
            ) : null}
            {ev.trader && <span className="text-muted"> @ {ev.trader}</span>}
            {ev.account_balance != null && (
              <span className="text-muted font-mono text-[10px]"> (balance: {ev.account_balance})</span>
            )}
          </>
        );
      case "violation":
      case "fame":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name}</span>
            <span className="text-muted"> — </span>
            <span style={{ color: meta.color }}>
              {ev.description || (ev.delta != null ? `${ev.delta >= 0 ? "+" : ""}${ev.delta} fame` : "")}
            </span>
          </>
        );
      case "vehicle_destruction":
        return (
          <>
            <span className="font-mono" style={{ color: meta.color }}>{ev.vehicle_pretty || ev.vehicle_class}</span>
            {ev.vehicle_id != null && <span className="text-dim"> #{ev.vehicle_id}</span>}
            <span className="text-muted"> {ev.reason === "EntityTimeout" ? "despawned" : "destroyed"}</span>
            {ev.owner_name && <><span className="text-muted"> · </span><span className="text-brand">{ev.owner_name}</span></>}
            {ev.killer_name && <><span className="text-muted"> by </span><span style={{ color: "var(--danger)" }}>{ev.killer_name}</span></>}
          </>
        );
      case "vehicle_claim":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name || "?"}</span>
            <span className="text-muted"> {ev.action === "transferred" ? "took over" : "claimed"} </span>
            <span className="font-mono" style={{ color: meta.color }}>{ev.vehicle_pretty || ev.vehicle_class}</span>
            {ev.vehicle_id != null && <span className="text-dim"> #{ev.vehicle_id}</span>}
          </>
        );
      case "lockpicking":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name}</span>
            <span style={{ color: ev.action === "success" ? "var(--success)" : "var(--danger)" }}>
              {ev.action === "success" ? " successfully picked " : " failed to pick "}
            </span>
            <span className="font-mono text-accent-brand">{ev.target_pretty || ev.target_name}</span>
          </>
        );
      case "mine_trigger":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name}</span>
            <span className="text-muted"> triggered mine </span>
            <span className="font-mono text-accent-brand">{ev.target_pretty || ev.target_name}</span>
            {ev.location && (
              <span className="text-muted font-mono text-[10px]">
                {" "}[{Math.round(ev.location.x)}, {Math.round(ev.location.y)}]
              </span>
            )}
          </>
        );
      case "chest_ownership":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name}</span>
            <span className="text-muted"> {ev.action} chest </span>
            <span className="font-mono text-accent-brand">{ev.target_pretty || ev.target_name}</span>
          </>
        );
      case "destruction":
        return (
          <>
            <span className="text-brand font-semibold">{ev.player_name || "Unknown"}</span>
            <span className="text-muted"> destroyed base element </span>
            <span className="font-mono text-accent-brand">{ev.target_pretty || ev.target_name}</span>
          </>
        );
      default: {
        let cleanRaw = ev.raw || "";
        if (ev.player_name && ev.steam_id) {
          const rx = new RegExp(`'${ev.steam_id}:${ev.player_name}\\(\\d+\\)'`, "g");
          cleanRaw = cleanRaw.replace(rx, ev.player_name);
          const rx2 = new RegExp(`${ev.steam_id}:${ev.player_name}\\(\\d+\\)`, "g");
          cleanRaw = cleanRaw.replace(rx2, ev.player_name);
        }
        cleanRaw = cleanRaw.replace(/Location:\s*X=(-?[\d.]+)\s+Y=(-?[\d.]+)\s+Z=(-?[\d.]+)/gi, (match, x, y, z) => {
          return `[Loc: ${Math.round(x)}, ${Math.round(y)}]`;
        });
        return <span className="text-brand font-mono text-[11px]">{cleanRaw}</span>;
      }
    }
  };

  return (
    <div
      className="group flex items-start gap-4 px-4 py-2 border-b border-brand hover:bg-surface-2 transition-colors font-mono text-xs leading-relaxed"
    >
      {/* Timestamp */}
      <span className="text-muted shrink-0 w-16" style={{ fontSize: 10 }}>
        {fmtTs(ev.ts)}
      </span>

      {/* Icon */}
      <span className="shrink-0 pt-0.5" style={{ color: meta.color }}>
        <Icon size={12} />
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0 pr-2">{renderBody()}</div>
    </div>
  );
};

/* ─── LiveDot ───────────────────────────────────────────────────────────── */
const LiveDot = ({ lastRefreshAt, loading }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => (n + 1) % 1e6), 500);
    return () => clearInterval(id);
  }, []);

  const sec = lastRefreshAt ? Math.max(0, Math.floor((Date.now() - lastRefreshAt) / 1000)) : null;
  const pulse = loading || (sec !== null && sec < 2);

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 font-mono"
      style={{ fontSize: 10, color: pulse ? "var(--success)" : "var(--text-muted)" }}
      title={sec !== null ? `Last refresh ${sec}s ago` : "Waiting…"}
      data-testid="logs-live-indicator"
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full transition-all duration-300"
        style={{
          background: pulse ? "var(--success)" : "var(--border-strong)",
          boxShadow: pulse ? "0 0 8px var(--success)" : "none",
        }}
      />
      <span className="uppercase tracking-widest">
        LIVE{sec !== null ? ` · ${sec}s` : ""}
      </span>
    </div>
  );
};

/* ─── LogsView ──────────────────────────────────────────────────────────── */
export const LogsView = ({ servers = [], activeServerId, onSelectServer }) => {
  const { t } = useI18n();
  const [serverId, setServerId]     = useState(activeServerId || servers[0]?.id || "");
  const [typeFilter, setTypeFilter] = useState("");
  const [chatChannel, setChatChannel] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");
  const [events, setEvents]         = useState([]);
  const [stats, setStats]           = useState({ by_type: {}, top_players: [], total: 0 });
  const [loading, setLoading]       = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);

  useEffect(() => { if (activeServerId) setServerId(activeServerId); }, [activeServerId]);
  useEffect(() => {
    if (servers.length && !servers.find(s => s.id === serverId)) {
      setServerId(activeServerId || servers[0]?.id || "");
    }
  }, [servers, serverId, activeServerId]);
  useEffect(() => { if (typeFilter !== "chat") setChatChannel(""); }, [typeFilter]);

  const load = async ({ scan = false } = {}) => {
    if (!serverId) return;
    setLoading(true);
    try {
      if (scan) endpoints.scanLogs(serverId, 20).catch(() => {});
      const params = { limit: 300 };
      if (typeFilter) params.type = typeFilter;
      if (playerFilter) params.player = playerFilter;
      const [evs, st] = await Promise.all([
        endpoints.listEvents(serverId, params),
        endpoints.eventStats(serverId, 0),
      ]);
      setEvents(evs.events || []);
      setStats(st);
      setLastRefreshAt(Date.now());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [serverId, typeFilter, playerFilter]);
  useEffect(() => {
    const id = setInterval(() => load({ scan: true }), 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [serverId, typeFilter, playerFilter]);

  const handleScan = async () => {
    if (!serverId) return;
    try {
      const r = await endpoints.scanLogs(serverId, 20);
      if (r.error) toast.error(r.error);
      else toast.success(`Scanned ${r.scanned} files · ${r.stored} new events`);
      load();
    } catch (e) { toast.error(String(e.response?.data?.detail || e.message)); }
  };

  const handleClear = async () => {
    if (!serverId) return;
    if (!window.confirm("Clear all events for this server?")) return;
    const r = await endpoints.clearEvents(serverId);
    toast(`Deleted ${r.deleted}`);
    load();
  };

  const activeServer = useMemo(() => servers.find(s => s.id === serverId), [servers, serverId]);

  const chatCounts = useMemo(() => {
    const acc = { Global: 0, Local: 0, Squad: 0, Admin: 0 };
    for (const ev of events)
      if (ev.type === "chat" && ev.channel && acc[ev.channel] !== undefined) acc[ev.channel]++;
    return acc;
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (typeFilter !== "chat" || !chatChannel) return events;
    return events.filter(ev => ev.type === "chat" && ev.channel === chatChannel);
  }, [events, typeFilter, chatChannel]);

  if (!servers.length) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg" data-testid="logs-view-empty">
        <div className="text-center text-dim text-sm">Add a server first to see its event feed.</div>
      </div>
    );
  }

  const categories = [
    { key: "", icon: ScrollText, labelKey: "all_events", color: "var(--accent)", count: stats.total },
    ...Object.entries(TYPE_META)
      .filter(([k]) => k !== "generic")
      .map(([k, m]) => ({ key: k, icon: m.icon, color: m.color, labelKey: m.labelKey, count: stats.by_type[k] || 0 })),
  ];

  const chatChannels = [
    { key: "",        label: t("all_events"),          color: "var(--info)" },
    { key: "Global",  label: t("chat_channel_global"), color: "#FFD166" },
    { key: "Local",   label: t("chat_channel_local"),  color: "var(--info)" },
    { key: "Squad",   label: t("chat_channel_squad"),  color: "var(--success)" },
    { key: "Admin",   label: t("chat_channel_admin"),  color: "var(--accent)" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg" data-testid="logs-view">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-bg-deep/80 backdrop-blur-md border-b border-strong px-6 py-4 flex items-center gap-4 shrink-0">
        <ScrollText size={18} className="text-accent-brand" />
        <div>
          <div className="label-accent">{t("nav_logs")}</div>
          <div className="heading-stencil text-lg font-semibold">{activeServer?.name || "—"}</div>
        </div>

        <div className="flex-1" />

        {/* Player search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
          <input
            className="input-field pl-8 text-xs w-56 rounded-xl border-strong focus:border-accent"
            placeholder={t("filter_by_player")}
            value={playerFilter}
            onChange={e => setPlayerFilter(e.target.value)}
            data-testid="logs-player-filter"
          />
        </div>

        <button
          className="btn-secondary flex items-center gap-2 rounded-xl"
          onClick={handleScan}
          data-testid="logs-scan-btn"
        >
          <FolderSearch size={13} /> {t("scan_logs_folder")}
        </button>

        <LiveDot lastRefreshAt={lastRefreshAt} loading={loading} />

        <button
          className="icon-btn rounded-xl border border-strong/40 bg-surface/40 p-2 hover:bg-surface/80 transition-all duration-200"
          onClick={() => load({ scan: true })}
          title={t("refresh_now")}
          data-testid="logs-refresh-btn"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        <button
          className="icon-btn rounded-xl border border-strong/40 bg-surface/40 p-2 hover:bg-surface/80 transition-all duration-200 hover:text-danger"
          onClick={handleClear}
          title={t("clear_events")}
          data-testid="logs-clear-btn"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Main content layout ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 flex flex-col gap-6">

        {/* Chrome-style category tabs */}
        <div className="flex flex-col">
          <div className="flex items-end gap-1 overflow-x-auto scrollbar-thin flex-nowrap relative" style={{ marginBottom: "-1px", zIndex: 2 }}>
            {categories.map((cat) => {
              const Icon = cat.icon;
              const active = typeFilter === cat.key;
              const color = cat.color || "var(--accent)";
              return (
                <button
                  key={cat.key}
                  onClick={() => setTypeFilter(cat.key)}
                  data-testid={cat.key ? `logs-filter-${cat.key}` : "logs-filter-all"}
                  className={`group flex items-center gap-2 px-3 py-2 text-[10px] font-display uppercase tracking-wider transition-all border shrink-0 ${
                    active
                      ? "bg-surface text-brand border-brand border-b-transparent rounded-t-md relative"
                      : "bg-bg/30 text-dim border-transparent hover:text-brand hover:bg-surface/40 rounded-t-md"
                  }`}
                  style={active ? {
                    borderBottom: "1px solid var(--surface)",
                    boxShadow: `inset 0 -2px 0 0 ${color}`
                  } : {}}
                >
                  <Icon size={12} style={{ color: active ? color : undefined }} className={active ? "" : "opacity-70"} />
                  <span>{t(cat.labelKey)}</span>
                  {cat.count > 0 && (
                    <span
                      className="font-mono rounded px-1 ml-1"
                      style={{
                        fontSize: 9,
                        background: active ? `color-mix(in srgb, ${color} 15%, transparent)` : "var(--surface-2)",
                        color: active ? color : "var(--text-muted)",
                        fontWeight: 700,
                      }}
                    >
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Log Feed Panel */}
          <div className="bg-surface border border-brand rounded-md rounded-tl-none flex flex-col overflow-hidden relative shadow-lg min-h-[350px]">
            {/* Feed Panel Header */}
            <div className="bg-bg-deep/40 border-b border-strong px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-accent-brand" />
                <span className="heading-stencil text-xs">
                  {typeFilter ? t(TYPE_META[typeFilter]?.labelKey || "all_events") : t("all_events")}
                </span>
                <span className="font-mono text-dim text-xs">({visibleEvents.length})</span>
              </div>

              {/* Chat Sub-filter inside Panel Header */}
              {typeFilter === "chat" && (
                <div className="flex items-center gap-1.5 flex-wrap" data-testid="logs-chat-subfilter">
                  <span className="label-overline text-[9px] shrink-0 mr-1.5">
                    {t("chat_channel_filter")}
                  </span>
                  {chatChannels.map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => setChatChannel(key)}
                      data-testid={`logs-chat-channel-${key.toLowerCase() || "all"}`}
                      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border transition-all duration-150 text-[9px] font-mono uppercase tracking-widest"
                      style={{
                        background: chatChannel === key ? `color-mix(in srgb, ${color} 15%, var(--surface))` : "transparent",
                        borderColor: chatChannel === key ? color : "var(--border-strong)",
                        color: chatChannel === key ? color : "var(--text-muted)",
                      }}
                    >
                      {label} · {key ? chatCounts[key] || 0 : events.filter(e => e.type === "chat").length}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable list */}
            <div className="flex-1 bg-bg-deep/20 divide-y divide-brand/40 overflow-y-auto max-h-[500px] scrollbar-thin">
              {visibleEvents.length === 0 ? (
                /* Empty state */
                <div className="p-16 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-strong bg-surface-2/40">
                    <ScrollText size={24} className="text-muted" />
                  </div>
                  <div>
                    <h3 className="heading-stencil text-sm mb-1">{t("logs_empty_title")}</h3>
                    <p className="text-dim text-xs max-w-xs leading-relaxed">{t("logs_empty_subtitle")}</p>
                  </div>
                </div>
              ) : (
                /* Rows */
                visibleEvents.map(ev => <EventRow key={ev.id} ev={ev} />)
              )}
            </div>
          </div>
        </div>

        {/* Top players Widget card */}
        {stats.top_players?.length > 0 && (
          <div className="panel p-5 relative overflow-hidden shrink-0">
            <span
              className="absolute left-0 top-0 bottom-0 w-1 rounded-r-md bg-accent-brand"
              style={{ boxShadow: "0 0 8px var(--accent)" }}
            />
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brand">
              <Users size={14} className="text-accent-brand" />
              <span className="heading-stencil text-xs">{t("top_players")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
              {stats.top_players.map((p, i) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 whitespace-nowrap text-xs bg-surface-2/60 border border-brand px-3 py-1 rounded-lg hover:border-accent-brand transition-colors"
                  data-testid={`top-player-${i}`}
                >
                  <span className="font-mono text-accent-brand font-bold">#{i + 1}</span>
                  <span className="text-brand font-medium">{p.name}</span>
                  <span className="text-muted font-mono" style={{ fontSize: 10 }}>· {p.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
