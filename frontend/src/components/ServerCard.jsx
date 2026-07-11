import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Play, Square, Download, RefreshCw, RotateCw, ArrowDownToLine, Settings, Trash2, Users, Activity,
  Server as ServerIcon, HardDrive, Clock, Network, Copy, Link2, Check, X, Stethoscope, FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";

const STATUS_META = {
  Running:   { cls: "running",    label: "server_status_running",    color: "var(--success)" },
  Starting:  { cls: "starting",   label: "server_status_starting",   color: "var(--warning)" },
  Stopped:   { cls: "stopped",    label: "server_status_stopped",    color: "var(--text-muted)" },
  Updating:  { cls: "updating",   label: "server_status_updating",   color: "var(--warning)" },
  Installing:{ cls: "installing", label: "installing",               color: "var(--accent)" },
  Stopping:  { cls: "stopping",   label: "server_status_stopping",   color: "var(--danger)" },
};

// Format seconds -> H:MM:SS  (or MM:SS if <1h)
const fmtUptime = (sec) => {
  if (!sec || sec < 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const fmtGb = (gb) => {
  if (gb == null) return "—";
  if (gb < 1) return `${Math.round(gb * 1024)} MB`;
  return `${gb.toFixed(1)} GB`;
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export const ServerCard = ({ server, onOpen, onStart, onStop, onUpdate, onInstall, onDelete, onChange, busy }) => {
  const { t } = useI18n();
  const status = STATUS_META[server.status] || STATUS_META.Stopped;
  const isRunning = server.status === "Running";
  const isStarting = server.status === "Starting";
  const processAlive = isRunning || isStarting || server.status === "Stopping";  // SCUM.exe is already up
  const gamePort = server.game_port ?? 7779;
  const queryPort = server.query_port ?? 7780;

  const [metrics, setMetrics] = useState(null);
  // Read max_players from the saved INI values (scum.MaxPlayers). Falls back
  // to the legacy `max_players` field or 64 if neither exists.
  const maxPlayers = Number(
    server.settings?.srv_general?.["scum.MaxPlayers"] ??
    server.max_players ?? 64
  );

  // Poll live metrics. While the server is in transient states (Starting,
  // Updating, Installing) we tighten the interval to 2s so the card flips
  // to RUNNING the moment the boot finishes — admins shouldn't have to
  // refresh the page to see status changes.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const m = await endpoints.serverMetrics(server.id);
        if (alive) setMetrics(m);
      } catch { /* network errors ignored — next poll retries */ }
    };
    load();
    const transient = ["Starting", "Updating", "Installing"].includes(server.status);
    const periodMs = transient ? 2000 : (processAlive ? 5000 : 15000);
    const interval = setInterval(load, periodMs);
    return () => { alive = false; clearInterval(interval); };
  }, [server.id, processAlive, server.installed, server.status]);

  return (
    <div className="server-card group" data-testid={`server-card-${server.folder_name}`}>
      {/* v1.0.46 — Type badge so admins instantly read "this is a local
          dedicated SCUM install" vs "this is a remote G-Portal/PingPerfect
          managed server". Sits inside .card-type-badge (CSS) at top. */}
      <div className="card-type-badge card-type-badge--local" data-testid={`card-type-${server.folder_name}`}>
        <ServerIcon size={10} />
        <span>{t("card_type_dedicated")}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-11 w-11 flex items-center justify-center border border-strong bg-surface-2 relative"
            style={{ clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)" }}
          >
            <ServerIcon size={18} className="text-accent-brand" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="status-led inline-block" style={{ background: status.color }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: status.color }}>
                {t(status.label)}
              </span>
            </div>
            <h3 className="heading-stencil text-base mt-1 truncate" data-testid={`server-card-name-${server.folder_name}`}>
              {server.name}
            </h3>
            <div className="font-mono text-[10px] text-muted uppercase tracking-widest mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{server.folder_name} · APPID 3792580</span>
              {server.installed_build_id && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest border"
                  style={{
                    color: server.update_available ? "var(--danger)" : "var(--success)",
                    borderColor: server.update_available ? "var(--danger)" : "var(--success)",
                    background: server.update_available
                      ? "color-mix(in srgb, var(--danger) 12%, transparent)"
                      : "color-mix(in srgb, var(--success) 12%, transparent)",
                  }}
                  title={server.update_available
                    ? `${t("update_available") || "Update available"} · ${server.installed_build_id}`
                    : `${t("up_to_date") || "Up to date"} · ${server.installed_build_id}`}
                  data-testid={`scum-version-pill-${server.folder_name}`}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "currentColor", boxShadow: "0 0 6px currentColor",
                  }} />
                  <span>SCUM {String(server.installed_build_id).replace(/^build-/i, "")}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          className="icon-btn"
          title={t("delete_server")}
          data-testid={`card-delete-${server.folder_name}`}
          onClick={(e) => { e.stopPropagation(); onDelete?.(server.id); }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Vitals row 1 — players / uptime / last build (v1.0.44: CPU removed,
          UPTIME moved into CPU's slot, LAST BUILD shown where UPTIME was) */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <MetricTile
          icon={Users}
          label={t("players")}
          value={
            typeof metrics?.players === "number"
              ? `${metrics.players}/${metrics.max_players_live || maxPlayers}`
              : `0/${maxPlayers}`
          }
          testId={`metric-players-${server.folder_name}`}
        />
        <MetricTile
          icon={Activity}
          label={t("uptime")}
          value={
            metrics?.ready
              ? fmtUptime(metrics.online_uptime_seconds)
              : metrics?.running
                ? t("server_warming_up")
                : "—"
          }
          testId={`metric-uptime-${server.folder_name}`}
        />
        <MetricTile
          icon={Clock}
          label={t("last_build") || "LAST BUILD"}
          value={fmtDate(metrics?.last_updated_iso)}
          small
          testId={`metric-lastbuild-${server.folder_name}`}
        />
      </div>

      {/* Vitals row 2 — RAM / DISK (LAST_UPDATE moved to row 1 as LAST BUILD) */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <MetricTile
          icon={Activity}
          label="RAM"
          value={metrics?.running && metrics.memory_mb ? `${Math.round(metrics.memory_mb)} MB` : "—"}
          testId={`metric-ram-${server.folder_name}`}
        />
        <MetricTile
          icon={HardDrive}
          label={t("disk") || "DISK"}
          value={metrics?.installed_size_gb ? fmtGb(metrics.installed_size_gb) : "—"}
          testId={`metric-disk-${server.folder_name}`}
        />
      </div>

      {/* Path & Ports */}
      <div className="border-t border-brand pt-3 mb-4 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="label-overline mb-1">{t("server_files_path")}</div>
            <div className="font-mono text-[11px] text-dim truncate" title={server.folder_path}>
              {server.folder_path}
            </div>
          </div>
          {/* v1.0.44 — Open folder shortcut here so admins don't have to dive
              into Settings just to open the SCUM install directory in Explorer. */}
          {server.installed && (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await endpoints.openServerFolder(server.id);
                  toast.success(t("folder_opened") || "Folder opened");
                } catch (err) {
                  toast.error(err.response?.data?.detail || err.message);
                }
              }}
              className="icon-btn shrink-0"
              title={t("open_server_folder") || "Open Server Folder"}
              data-testid={`card-open-folder-${server.folder_name}`}
            >
              <FolderOpen size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <Network size={11} className="text-muted" />
          <span className="text-muted">PORT</span>
          <span className="text-brand">{gamePort}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">QUERY</span>
          <span className="text-brand">{queryPort}</span>
          <span className="text-muted ml-auto text-[10px]">{t("settings_arrow_basic")}</span>
        </div>

        {/* Connect info — SCUM's in-game "Direct Connect" uses gamePort+2 */}
        <ConnectInfo gamePort={gamePort} testId={server.folder_name} serverId={server.id} installed={server.installed} processAlive={processAlive} />
      </div>

      {/* v1.0.37j — Activity Chart removed from card per user request. */}

      {/* Actions */}
      <div className="flex gap-2">
        {!server.installed && (
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={(e) => { e.stopPropagation(); onInstall?.(server); }}
            disabled={busy || server.status === "Installing"}
            data-testid={`card-install-${server.folder_name}`}
          >
            <Download size={13} /> {server.status === "Installing" ? t("installing") : t("install_server")}
          </button>
        )}

        {server.installed && !processAlive && (
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={(e) => { e.stopPropagation(); onStart?.(server); }}
            disabled={busy}
            data-testid={`card-start-${server.folder_name}`}
          >
            <Play size={13} /> {t("start")}
          </button>
        )}

        {isStarting && (
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled
            data-testid={`card-starting-${server.folder_name}`}
            style={{ background: "var(--warning)", color: "var(--bg-deep)" }}
          >
            <Activity size={13} className="animate-pulse" /> {t("server_status_starting")}
          </button>
        )}

        {(isRunning || isStarting) && (
          <button
            className="btn-danger flex-1 flex items-center justify-center gap-2"
            onClick={(e) => { e.stopPropagation(); onStop?.(server); }}
            disabled={busy}
            data-testid={`card-stop-${server.folder_name}`}
          >
            <Square size={13} /> {t("stop")}
          </button>
        )}

        {server.status === "Stopping" && (
          <button
            className="btn-danger flex-1 flex items-center justify-center gap-2"
            disabled
            data-testid={`card-stopping-${server.folder_name}`}
            style={{ opacity: 0.7 }}
          >
            <Square size={13} className="animate-pulse" /> {t("server_status_stopping")}...
          </button>
        )}

        {(isRunning || isStarting) && (
          <button
            className="btn-secondary flex items-center justify-center gap-2 px-3"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const updated = await endpoints.restartServer(server.id);
                onChange?.(updated);
              } catch (err) {
                // non-fatal; parent toast will surface backend failures on next poll
              }
            }}
            disabled={busy}
            title={t("restart")}
            data-testid={`card-restart-${server.folder_name}`}
          >
            <RotateCw size={13} />
          </button>
        )}

        {server.installed && (
          <button
            className={`btn-secondary flex items-center justify-center gap-2 px-3 ${server.update_available ? "update-pulse" : ""}`}
            onClick={(e) => { e.stopPropagation(); onUpdate?.(server); }}
            disabled={busy || processAlive}
            title={t("card_btn_update")}
            data-testid={`card-update-${server.folder_name}`}
          >
            <ArrowDownToLine size={15} strokeWidth={2.5} />
          </button>
        )}

        <button
          className="btn-secondary flex items-center justify-center gap-2 px-3"
          onClick={(e) => { e.stopPropagation(); onOpen?.(server); }}
          data-testid={`card-open-${server.folder_name}`}
          title={t("nav_configs")}
          disabled={!server.installed}
          style={!server.installed ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
        >
          <Settings size={13} />
        </button>
      </div>
    </div>
  );
};

const MetricTile = ({ icon: Icon, label, value, small, testId }) => (
  <div className="border border-brand bg-bg-deep px-3 py-2.5" data-testid={testId}>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={11} className="text-muted" />
      <span className="label-overline">{label}</span>
    </div>
    <div className={`font-mono ${small ? "text-[10px]" : "text-sm"} text-brand truncate`} title={String(value)}>
      {value}
    </div>
  </div>
);

/**
 * ConnectInfo — shows the IP:Port string players paste into SCUM's "Direct
 * Connect" box. SCUM's UDP convention: the reachable connect port is the
 * configured game_port + 2 (e.g. game_port 7777 → connect via 7779). Public
 * IP is fetched lazily from the backend (which queries ipify, cached 5min).
 *
 * v1.0.37j — Now includes a CONNECTION HEALTH LED on the left side:
 *   green  = process alive + query port answers + Steam master reachable
 *   yellow = process+query OK but master UNREACHABLE (outbound firewall?)
 *   red    = process down OR query port silent
 * Clicking the LED opens a Diagnose modal that explains each check + hints.
 */
const ConnectInfo = ({ gamePort, testId, serverId, installed, processAlive }) => {
  const { t } = useI18n();
  const [ip, setIp] = useState(null);
  const [copied, setCopied] = useState(false);
  const [diag, setDiag] = useState(null);
  const [showDiag, setShowDiag] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const connectPort = (parseInt(gamePort, 10) || 7777) + 2;

  useEffect(() => {
    let alive = true;
    endpoints.getPublicIp()
      .then((r) => { if (alive) setIp(r?.ip || null); })
      .catch(() => { if (alive) setIp(null); });
    return () => { alive = false; };
  }, []);

  // Poll the LED state. Only meaningful for installed servers. While alive
  // we re-check every 15s; for stopped servers we still do one initial check
  // (so the LED shows red immediately).
  const refreshDiag = async () => {
    if (!installed || !serverId) return;
    setRefreshing(true);
    try {
      const d = await endpoints.getConnectionDiagnostics(serverId);
      setDiag(d);
    } catch { /* keep last value */ }
    finally { setRefreshing(false); }
  };
  useEffect(() => {
    if (!installed) { setDiag(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const d = await endpoints.getConnectionDiagnostics(serverId);
        if (alive) setDiag(d);
      } catch { /* transient — keep last known LED state */ }
    };
    load();
    // Faster cadence when running (10s) so the LED flips quickly after a
    // start/stop. Slower when stopped (30s) since nothing's changing.
    const i = setInterval(load, processAlive ? 10000 : 30000);
    return () => { alive = false; clearInterval(i); };
  }, [installed, serverId, processAlive]);

  const addr = ip ? `${ip}:${connectPort}` : t("connect_unavailable");

  const copy = async (e) => {
    e.stopPropagation();
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      toast.success(t("connect_copied"));
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("clipboard_failed"));
    }
  };

  const ledColor = !installed
    ? "var(--text-muted)"
    : diag?.status === "green"  ? "var(--success)"
    : diag?.status === "yellow" ? "var(--warning)"
    : diag?.status === "red"    ? "var(--danger)"
    : "var(--text-muted)";

  const statusLabel = !installed
    ? t("diag_led_not_installed")
    : !diag ? t("diag_led_checking")
    : diag.status === "green"  ? t("diag_led_green")
    : diag.status === "yellow" ? t("diag_led_yellow")
                               : t("diag_led_red");

  return (
    <>
      {/* CONNECT row (LED removed — moved to a dedicated row below) */}
      <button
        type="button"
        onClick={copy}
        disabled={!ip}
        className="w-full flex items-center gap-2 px-2 py-1.5 border border-dashed border-brand hover:border-accent-brand hover:bg-bg-deep transition-colors font-mono text-[11px] text-left group disabled:opacity-60 disabled:cursor-not-allowed"
        data-testid={`card-connect-info-${testId}`}
        title={t("connect_tooltip")}
      >
        <Link2 size={11} className="text-accent-brand shrink-0" />
        <span className="text-muted uppercase text-[9px] tracking-widest">
          {t("connect")}
        </span>
        <span className="text-brand truncate flex-1">{addr}</span>
        {ip && (
          copied
            ? <Check size={12} className="text-[var(--success)] shrink-0" />
            : <Copy size={12} className="text-muted group-hover:text-accent-brand shrink-0" />
        )}
      </button>

      {/* v1.0.44 — SUNUCU DURUMU row (replaces the LED dot inside the Connect
          line). Click opens the same DiagnoseModal. Shown only when the server
          is installed — uninstalled servers have nothing to diagnose. */}
      {installed && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDiag(true); }}
          className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 border bg-bg-deep/40 font-mono text-[11px] text-left transition-colors hover:bg-bg-deep group"
          style={{
            borderColor: ledColor,
            background: `color-mix(in srgb, ${ledColor} 6%, transparent)`,
          }}
          data-testid={`connect-health-led-${testId}`}
          title={statusLabel}
        >
          <Stethoscope size={11} style={{ color: ledColor }} className="shrink-0" />
          <span className="text-muted uppercase text-[9px] tracking-widest">
            {t("server_status_label")}
          </span>
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ background: ledColor, boxShadow: `0 0 6px ${ledColor}` }}
          />
          <span className="truncate flex-1" style={{ color: ledColor }}>
            {statusLabel}
          </span>
          <span className="text-[9px] text-dim uppercase tracking-widest group-hover:text-accent-brand">
            {t("diag_details")}
          </span>
        </button>
      )}

      {showDiag && createPortal(
        <DiagnoseModal
          diag={diag}
          onClose={() => setShowDiag(false)}
          onRefresh={refreshDiag}
          refreshing={refreshing}
          testId={testId}
        />,
        document.body
      )}
    </>
  );
};

const DiagnoseModal = ({ diag, onClose, onRefresh, refreshing, testId }) => {
  const { t } = useI18n();
  const statusColor =
    diag?.status === "green"  ? "var(--success)" :
    diag?.status === "yellow" ? "var(--warning)" :
    diag?.status === "red"    ? "var(--danger)"  : "var(--text-muted)";
  const statusLabel =
    diag?.status === "green"  ? t("diag_led_green") :
    diag?.status === "yellow" ? t("diag_led_yellow") :
    diag?.status === "red"    ? t("diag_led_red") :
    t("diag_led_checking");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      data-testid={`diagnose-modal-${testId}`}
    >
      <div
        className="w-full max-w-md bg-surface border border-brand rounded-xl shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent-soft/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="px-5 py-4 border-b border-brand/60 flex items-center justify-between bg-bg/25">
          <div className="flex items-center gap-2">
            <Stethoscope size={15} className="text-accent-brand" />
            <span className="heading-stencil text-sm tracking-wider uppercase">{t("diag_modal_title")}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="icon-btn hover:bg-bg/40 p-1 rounded-md" data-testid="diagnose-modal-close">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Headline Status Bar */}
          <div className="flex items-center gap-3 border border-brand bg-bg/40 px-4 py-3 rounded-lg"
               style={{ borderColor: statusColor }}>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: statusColor, boxShadow: `0 0 10px ${statusColor}` }}
            />
            <span className="font-mono text-xs uppercase tracking-wider font-bold" style={{ color: statusColor }}>
              {statusLabel}
            </span>
            <button
              className="btn-ghost text-[10px] ml-auto flex items-center gap-1.5 px-2 py-1 rounded bg-bg/30 hover:bg-bg/60 border border-brand/35 transition-colors"
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              disabled={refreshing}
              data-testid="diagnose-modal-refresh"
            >
              <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
              {t("diag_refresh")}
            </button>
          </div>

          {/* Per-check rows */}
          {diag && (
            <div className="space-y-3">
              {[
                { k: "process_alive",   tip: t("diag_check_process_hint") },
                { k: "query_port_open", tip: t("diag_check_query_hint") },
                { k: "master_reachable",tip: t("diag_check_master_hint") },
              ].map(({ k, tip }) => {
                const c = diag.checks?.[k];
                if (!c) return null;
                return (
                  <div key={k} className="border border-brand/40 bg-bg/15 p-3.5 rounded-lg transition-all duration-200 hover:border-brand/70"
                       data-testid={`diag-check-${k}`}>
                    <div className="flex items-center gap-2.5">
                      {c.ok
                        ? <Check size={14} className="text-success shrink-0" />
                        : <X size={14} className="text-danger shrink-0" />}
                      <span className="font-mono text-xs text-brand font-bold">{t(c.label)}</span>
                      {c.detail && (
                        <span className="font-mono text-[9px] text-dim px-2 py-0.5 bg-bg/50 border border-brand/40 rounded ml-auto">{c.detail}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-dim mt-1.5 ml-6 leading-relaxed">{tip}</p>
                    {c.latency_ms != null && (
                      <p className="text-[9px] text-brand/80 mt-1 ml-6 font-mono">
                        Latency: {c.latency_ms} ms
                      </p>
                    )}
                    {c.error && (
                      <div className="p-2.5 bg-danger/5 border border-danger/20 text-danger text-[9px] font-mono rounded mt-2.5 ml-6 break-all whitespace-pre-wrap">
                        {c.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hints Panel */}
          {diag?.hints?.length > 0 && (
            <div className="border-l-2 pl-4 py-2.5 bg-bg/10 border-brand rounded-r-lg" style={{ borderLeftColor: statusColor }}>
              {diag.hints.map((h, i) => (
                <p key={i} className="text-xs text-brand mb-1 last:mb-0 leading-relaxed">{t(h)}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

