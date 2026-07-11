import React, { useEffect, useMemo, useState } from "react";
import { Plus, ShieldAlert, Server, Play, Square, Activity, RefreshCw, Globe } from "lucide-react";
import { useI18n } from "../providers/I18nProvider";
import { toast } from "sonner";
import { ServerCard } from "./ServerCard";
import { RemoteServerCard } from "./RemoteServerCard";
import { ConnectRemoteModal } from "./ConnectRemoteModal";
import { ConfirmModal } from "./ConfirmModal";
import { InstallProgressModal } from "./InstallProgressModal";
import { endpoints, api } from "../lib/api";

export const DashboardView = ({ servers, managerPath, onAdd, onOpen, onChange, onDelete, onRefresh }) => {
  const { t } = useI18n();
  const [confirmDel, setConfirmDel] = useState(null);
  const [checking, setChecking] = useState(false);
  const [installTarget, setInstallTarget] = useState(null);
  // Same modal is reused for "Update" — we just label the title differently.
  const [updateTarget, setUpdateTarget] = useState(null);
  // v1.0.45 — Remote Hosted Servers (G-Portal, PingPerfect, generic FTP/SFTP)
  const [remoteServers, setRemoteServers] = useState([]);
  const [showRemoteModal, setShowRemoteModal] = useState(false);

  useEffect(() => {
    let alive = true;
    endpoints.listRemoteServers()
      .then((rows) => { if (alive) setRemoteServers(rows); })
      .catch(() => { if (alive) setRemoteServers([]); });
    return () => { alive = false; };
  }, []);

  const reloadRemotes = async () => {
    try {
      const rows = await endpoints.listRemoteServers();
      setRemoteServers(rows);
    } catch { /* keep stale list */ }
  };

  const running = useMemo(() => servers.filter((s) => s.status === "Running").length, [servers]);
  const stopped = useMemo(() => servers.filter((s) => s.status !== "Running").length, [servers]);

  const handleInstall = async (server) => {
    try {
      // Kick off install (backend spawns SteamCMD in background thread)
      const updated = await endpoints.installServer(server.id);
      onChange(updated);
      setInstallTarget(updated);    // open modal — it polls progress
    } catch (e) { toast.error(String(e.message || e)); }
  };

  const handleInstallDone = async (success) => {
    try {
      if (success && installTarget) {
        // Refresh server doc (backend updates installed=true on completion)
        const fresh = await endpoints.getServer(installTarget.id);
        try { await endpoints.postInstall(fresh.id); } catch (_) {}
        onChange(fresh);
        toast.success(t("install_complete"));
      } else if (installTarget) {
        const fresh = await endpoints.getServer(installTarget.id);
        onChange(fresh);
        toast.error(t("install_failed"));
      }
    } catch {}
  };

  const handleStart = async (server) => {
    try {
      const updated = await endpoints.startServer(server.id);
      onChange(updated);
      toast.success(t("toast_server_started"));
    } catch (e) { toast.error(String(e.message || e)); }
  };

  const handleStop = async (server) => {
    try {
      const updated = await endpoints.stopServer(server.id);
      onChange(updated);
      toast(t("toast_server_stopped"));
    } catch (e) { toast.error(String(e.message || e)); }
  };

  const handleUpdate = async (server) => {
    try {
      // Backend kicks off SteamCMD update in a background thread (Windows)
      // or simulates it (Linux preview). Either way, polling /install/progress
      // gives us live %.
      const updated = await endpoints.updateServer(server.id);
      onChange(updated);
      setUpdateTarget(updated);  // open progress modal
    } catch (e) { toast.error(String(e.response?.data?.detail || e.message || e)); }
  };

  const handleUpdateDone = async (success) => {
    try {
      if (updateTarget) {
        const fresh = await endpoints.getServer(updateTarget.id);
        onChange(fresh);
        if (success) toast.success(t("toast_update_done") || "Update complete");
        else toast.error(t("toast_update_failed") || "Update failed");
      }
    } catch {}
  };

  const requestDelete = (id) => {
    const server = servers.find((s) => s.id === id);
    if (server) setConfirmDel(server);
  };

  // v1.0.36 — Removed Start All / Restart All / Stop All bulk buttons
  // (per user request). Per-server controls in the ServerCard are enough
  // and the bulk versions were confusing admins who managed mixed clusters.
  // The /api endpoints still exist for backwards compatibility but are
  // no longer wired to any UI.
  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const info = await endpoints.steamCheckUpdate();
      toast.success(`${t("latest_build")}: ${info.latest_build_id.slice(0, 20)}`);
      onRefresh?.();
    } catch (e) { toast.error(String(e.message || e)); }
    finally { setChecking(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-bg relative" data-testid="dashboard-view">
      <div className="boot-scan" />

      {/* Hero Command Bar */}
      <div className="relative border-b border-brand bg-bg-deep overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--border-strong) 1px, transparent 1px), linear-gradient(90deg, var(--border-strong) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative px-8 py-8 flex items-end justify-between gap-6">
          <div>
            <div className="label-accent mb-2">{t("nav_fleet")}</div>
            <h1 className="heading-stencil text-3xl lg:text-4xl">
              {t("nav_dashboard")}
            </h1>
            <p className="text-dim text-sm mt-2 max-w-lg">
              {t("deploy_subtitle")}
            </p>
            {servers.length > 0 && (
              <div className="mt-4 flex items-center gap-2 flex-wrap" data-testid="dashboard-global-actions">
                <button
                  onClick={handleCheckUpdate}
                  disabled={checking}
                  className="btn-ghost flex items-center gap-2"
                  data-testid="dashboard-check-update-btn"
                >
                  <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                  {t("check_now")}
                </button>
              </div>
            )}
          </div>

          {/* Big stat tiles */}
          <div className="flex items-stretch gap-3">
            <StatTile icon={Server} label={t("fleet_total")} value={servers.length} accent />
            <StatTile icon={Play} label={t("fleet_online")} value={running} color="var(--success)" />
            <StatTile icon={Square} label={t("fleet_offline")} value={stopped} color="var(--text-muted)" />
            {/* v1.0.46 — Two CLEAN side-by-side CTAs (the previous diagonal
                split looked muddled). Each is its own pill panel with its
                own accent colour so admins instantly tell local vs remote. */}
            <button
              onClick={(e) => { e.preventDefault(); toast.info(t("remote_testing_locked")); }}
              className="cta-pill cta-pill-remote cta-pill-locked"
              data-testid="connect-remote-btn"
              title={t("remote_testing_locked")}
              aria-disabled="true"
            >
              {/* v1.0.51 — diagonal TESTING ribbon overlay until the feature
                  is fully validated end-to-end against real G-Portal hosts. */}
              <span className="cta-pill-ribbon" aria-hidden>TESTING</span>
              <span className="cta-pill-halo" aria-hidden />
              <Globe size={16} className="cta-pill-icon" />
              <div className="cta-pill-text">
                <span className="cta-pill-sub">{t("remote_cta_sub")}</span>
                <span className="cta-pill-title">{t("remote_cta_title")}</span>
              </div>
            </button>
            <button
              onClick={onAdd}
              data-testid="deploy-new-server-btn"
              className="cta-pill cta-pill-local"
            >
              <span className="cta-pill-halo" aria-hidden />
              <Plus size={16} className="cta-pill-icon" />
              <div className="cta-pill-text">
                <span className="cta-pill-sub">{t("deploy_subtitle")}</span>
                <span className="cta-pill-title">{t("deploy_new_server")}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Admin warning banner */}
      {!managerPath && (
        <div className="mx-8 mt-6 p-4 border border-danger flex items-center gap-3 bg-danger/5" style={{ borderColor: "var(--danger)" }}>
          <ShieldAlert size={18} className="text-danger" />
          <span className="text-danger font-mono text-xs uppercase tracking-wider">
            Workspace not configured · complete disk selection first
          </span>
        </div>
      )}

      {/* Server grid */}
      {servers.length === 0 && remoteServers.length === 0 ? (
        <EmptyFleet onAdd={onAdd} t={t} />
      ) : (
        <div className="p-8">
          <div className="flex items-center gap-3 mb-5">
            <Activity size={14} className="text-accent-brand" />
            <div className="label-accent">{t("action_grid")}</div>
            <div className="flex-1 h-px bg-brand" />
            <div className="font-mono text-[11px] text-dim">
              {servers.length + remoteServers.length} UNIT{(servers.length + remoteServers.length) !== 1 ? "S" : ""}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* v1.0.46 — Local + remote cards live in ONE responsive grid so
                admins see their whole fleet side-by-side. Each card carries
                a coloured type badge ("DEDICATED" / "PORTAL") so the
                distinction is obvious without a section divider. Locals
                render first (more frequently used), remotes after. */}
            {servers.map((s) => (
              <ServerCard
                key={`local-${s.id}`}
                server={s}
                onOpen={onOpen}
                onStart={handleStart}
                onStop={handleStop}
                onUpdate={handleUpdate}
                onInstall={handleInstall}
                onDelete={requestDelete}
                onChange={onChange}
              />
            ))}
            {remoteServers.map((r) => (
              <RemoteServerCard
                key={`remote-${r.id}`}
                server={r}
                onChange={reloadRemotes}
                onDelete={() => reloadRemotes()}
                onOpen={() => toast.info(t("remote_settings_coming_soon"))}
              />
            ))}
          </div>
        </div>
      )}

      {/* v1.0.46 — Empty-fleet special case: show both card types' "deploy"
          panels here too when locals AND remotes are both empty. */}

      {showRemoteModal && (
        <ConnectRemoteModal
          onClose={() => setShowRemoteModal(false)}
          onCreated={() => reloadRemotes()}
        />
      )}

      <ConfirmModal
        open={!!confirmDel}
        title={t("confirm_delete_title")}
        body={t("confirm_delete_body", { name: confirmDel?.name || "" })}
        confirmLabel={t("confirm_yes_delete")}
        cancelLabel={t("cancel")}
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => { const id = confirmDel?.id; setConfirmDel(null); if (id) onDelete(id); }}
        testId="dashboard-delete-modal"
      />

      <InstallProgressModal
        open={!!installTarget}
        server={installTarget}
        onClose={() => setInstallTarget(null)}
        onDone={handleInstallDone}
      />

      {/* Same SteamCMD progress UI, reused for updates. The component itself
          polls /install/progress — backend writes update progress to the same
          REGISTRY slot, so a single modal handles both flows. */}
      <InstallProgressModal
        open={!!updateTarget}
        server={updateTarget}
        mode="update"
        onClose={() => setUpdateTarget(null)}
        onDone={handleUpdateDone}
      />
    </div>
  );
};

const StatTile = ({ icon: Icon, label, value, color, accent }) => {
  // v1.0.44 — Animate visible flash whenever the displayed value CHANGES so
  // admins glance up and immediately catch fleet movement (server going
  // online/offline, new install). 600ms one-shot class toggle.
  const prevValueRef = React.useRef(value);
  const [flashing, setFlashing] = React.useState(false);
  React.useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setFlashing(true);
      const id = setTimeout(() => setFlashing(false), 700);
      return () => clearTimeout(id);
    }
  }, [value]);

  const tintColor = accent ? "var(--accent)" : (color || "var(--text)");
  const tintSoft = accent
    ? "color-mix(in srgb, var(--accent) 18%, transparent)"
    : `color-mix(in srgb, ${color || "var(--text-dim)"} 14%, transparent)`;

  return (
    <div
      className={`stat-tile-modern min-w-[150px] px-4 py-3 relative overflow-hidden ${flashing ? "stat-tile-flash" : ""}`}
      style={{
        "--tile-color": tintColor,
        "--tile-soft": tintSoft,
      }}
      data-testid={`stat-tile-${(label || "").toString().toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Glow halo background */}
      <span className="stat-tile-halo" aria-hidden />
      {/* Header row: icon-circle + label */}
      <div className="flex items-center gap-2 mb-1 relative z-10">
        <span className="stat-tile-icon">
          <Icon size={12} style={{ color: tintColor }} />
        </span>
        <span className="label-overline" style={{ color: tintColor }}>{label}</span>
      </div>
      {/* Big numeric value */}
      <div
        className="font-mono text-3xl tracking-wider relative z-10"
        style={{ color: tintColor, textShadow: `0 0 22px ${tintSoft}` }}
      >
        {String(value).padStart(2, "0")}
      </div>
    </div>
  );
};

const EmptyFleet = ({ onAdd, t }) => (
  <div className="p-16 flex items-center justify-center" data-testid="empty-fleet">
    <div className="text-center max-w-lg">
      <div
        className="mx-auto h-24 w-24 flex items-center justify-center border-2 border-accent-brand mb-6 relative corner-brackets-full"
        style={{ background: "var(--accent-soft)" }}
      >
        <span className="cbr-tr" />
        <span className="cbr-bl" />
        <Server size={36} className="text-accent-brand" />
      </div>
      <div className="label-accent mb-2">{t("empty_workspace_title").toUpperCase()}</div>
      <h2 className="heading-stencil text-2xl mb-3">{t("empty_workspace_title")}</h2>
      <p className="text-dim text-sm leading-relaxed mb-8">{t("no_servers_subtitle")}</p>
      <button onClick={onAdd} data-testid="empty-add-server-button" className="btn-primary inline-flex items-center gap-2">
        <Plus size={14} /> {t("deploy_first_server")}
      </button>
    </div>
  </div>
);
