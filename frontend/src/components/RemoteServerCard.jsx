/**
 * RemoteServerCard — v1.0.45 Phase 1.
 *
 * Mirrors `ServerCard` but renders the badges/metrics relevant to a remote
 * hosted server (G-Portal, PingPerfect, generic FTP/SFTP). Phase 1 shows
 * only identity + connection metadata + a Test/Settings/Delete action row.
 * Phase 2 will add remote settings INI editing, log download, etc.
 */
import React, { useEffect, useState } from "react";
import { Globe, RefreshCw, Settings, Trash2, Lock, FolderTree, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";

export const RemoteServerCard = ({ server, onChange, onDelete, onOpen }) => {
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState(null);

  useEffect(() => {
    // Surface the last-known test state from the persisted server doc so the
    // card lights up correctly on first render without a fresh round-trip.
    // Defensive `!= null` (NOT `!== null`) so a future schema drop returning
    // `undefined` instead of `null` still triggers the effect correctly.
    if (server.last_test_ok != null) {
      setProbe({ ok: !!server.last_test_ok });
    }
  }, [server.last_test_ok]);

  const handleTest = async (e) => {
    e?.stopPropagation();
    setTesting(true);
    try {
      const r = await endpoints.testExistingRemote(server.id);
      setProbe(r);
      if (r.ok) toast.success(t("remote_test_ok"));
      else toast.error(`${t("remote_test_failed")}: ${r.error || "?"}`);
      onChange?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (e) => {
    e?.stopPropagation();
    if (!window.confirm(t("remote_confirm_delete", { name: server.name }))) return;
    try {
      await endpoints.deleteRemoteServer(server.id);
      toast.success(t("remote_deleted"));
      onDelete?.(server.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    }
  };

  const statusColor = probe?.ok ? "var(--success)" : (probe ? "var(--danger)" : "var(--text-muted)");
  const statusText = probe?.ok ? t("remote_status_ok") : (probe ? t("remote_status_fail") : t("remote_status_unknown"));

  return (
    <div className="server-card remote-server-card" data-testid={`remote-card-${server.id}`}>
      {/* v1.0.46 — Type badge: PORTAL SERVER (cyan) so it reads instantly
          against the orange DEDICATED SERVER badge on local cards. */}
      <div className="card-type-badge card-type-badge--portal" data-testid={`card-type-remote-${server.id}`}>
        <Globe size={10} />
        <span>{t("card_type_portal")}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="remote-card-icon" aria-hidden>
            <Globe size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="label-overline" style={{ color: statusColor }}>
                {statusText}
              </span>
              {server.provider_hint && (
                <span className="provider-pill">{server.provider_hint}</span>
              )}
            </div>
            <div className="heading-stencil text-lg">{server.name}</div>
            <div className="font-mono text-[10px] text-dim mt-0.5">
              {server.protocol.toUpperCase()} · {server.host}:{server.port}
            </div>
          </div>
        </div>
        <button onClick={handleDelete} className="icon-btn" title={t("delete")} data-testid={`remote-delete-${server.id}`}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Path & user info */}
      <div className="border-t border-brand pt-3 mb-4 space-y-3">
        <div>
          <div className="label-overline mb-1 flex items-center gap-1">
            <FolderTree size={11} className="text-accent-brand" />
            {t("remote_path_label")}
          </div>
          <div className="font-mono text-[11px] text-dim truncate" title={server.remote_path}>
            {server.remote_path}
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <Lock size={11} className="text-muted" />
          <span className="text-muted">USER</span>
          <span className="text-brand">{server.username}</span>
          <span className="ml-auto text-[10px] text-dim">
            {server.last_tested_at ? `tested ${new Date(server.last_tested_at).toLocaleString()}` : "never tested"}
          </span>
        </div>

        {/* Status indicator row — same pattern as local ServerCard */}
        <div
          className="w-full flex items-center gap-2 px-2 py-1.5 border bg-bg-deep/40 font-mono text-[11px]"
          style={{
            borderColor: statusColor,
            background: `color-mix(in srgb, ${statusColor} 6%, transparent)`,
            borderRadius: 10,
          }}
        >
          {probe?.ok
            ? <Check size={11} style={{ color: statusColor }} />
            : <AlertCircle size={11} style={{ color: statusColor }} />}
          <span className="text-muted uppercase text-[9px] tracking-widest">
            {t("remote_connection_label")}
          </span>
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
          />
          <span className="flex-1" style={{ color: statusColor }}>{statusText}</span>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
          data-testid={`remote-test-${server.id}`}
        >
          <RefreshCw size={12} className={testing ? "animate-spin" : ""} />
          {t("remote_test_btn")}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen?.(server); }}
          className="btn-secondary inline-flex items-center gap-2"
          data-testid={`remote-settings-${server.id}`}
          title={t("remote_settings_btn")}
        >
          <Settings size={13} />
        </button>
      </div>
    </div>
  );
};
