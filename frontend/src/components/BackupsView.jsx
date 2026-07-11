import React, { useEffect, useMemo, useState } from "react";
import { Archive, Download, RefreshCw, Save, Trash2, Upload, AlertTriangle, Clock, HardDrive, Timer, Info } from "lucide-react";
import { toast } from "sonner";
import { endpoints, API } from "../lib/api";
import { useI18n } from "../providers/I18nProvider";


const TYPE_META = {
  manual:      { label: "backup_type_manual",      color: "var(--info)" },
  auto:        { label: "backup_type_auto",        color: "var(--text-dim)" },
  crash:       { label: "backup_type_crash",       color: "var(--danger)" },
  pre_restore: { label: "backup_type_pre_restore", color: "var(--warning)" },
};


const fmtTs = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
  } catch { return iso; }
};


/**
 * DiskUsageStrip — a beautiful visual representation of space consumed.
 */
const DiskUsageStrip = ({ data, t }) => {
  const seg = useMemo(() => {
    const sums = { protected: 0, prune: 0, crash: 0 };
    let protectedCount = 0, pruneCount = 0, crashCount = 0;
    for (const b of data.backups || []) {
      if (b.backup_type === "manual" || b.backup_type === "pre_restore") {
        sums.protected += b.size_bytes;
        protectedCount += 1;
      } else if (b.backup_type === "crash") {
        sums.crash += b.size_bytes;
        crashCount += 1;
      } else {
        sums.prune += b.size_bytes;
        pruneCount += 1;
      }
    }
    return { sums, protectedCount, pruneCount, crashCount };
  }, [data.backups]);

  const totalMb = data.total_size_mb || 0;
  const tier = totalMb < 2000 ? "green" : totalMb < 10000 ? "yellow" : "red";
  const tierColor = tier === "green" ? "var(--success)" : tier === "yellow" ? "var(--warning)" : "var(--danger)";

  const total = seg.sums.protected + seg.sums.prune + seg.sums.crash;
  const pct = (n) => (total === 0 ? 0 : (n / total) * 100);

  return (
    <div className="bg-surface/50 border border-brand p-5 rounded-xl shadow-lg relative overflow-hidden" data-testid="backups-disk-strip">
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent-soft/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="label-overline text-dim block mb-1">{t("disk_usage")}</span>
          <span className="text-3xl font-display font-extrabold tracking-tight" style={{ color: tierColor }}>
            {totalMb.toFixed(1)} <span className="text-sm font-normal text-dim">MB</span>
          </span>
        </div>
        <HardDrive className="text-accent-brand opacity-60" size={24} />
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full overflow-hidden border border-brand/60 rounded-full bg-bg/50 mb-4 flex" data-testid="backups-disk-bar">
        {seg.sums.protected > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct(seg.sums.protected)}%`, background: "var(--info)" }}
            title={`${t("disk_protected")}: ${(seg.sums.protected / (1024 * 1024)).toFixed(1)} MB`}
          />
        )}
        {seg.sums.crash > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct(seg.sums.crash)}%`, background: "var(--danger)" }}
            title={`${t("disk_crash")}: ${(seg.sums.crash / (1024 * 1024)).toFixed(1)} MB`}
          />
        )}
        {seg.sums.prune > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct(seg.sums.prune)}%`, background: "var(--text-dim)", opacity: 0.55 }}
            title={`${t("disk_pruneable")}: ${(seg.sums.prune / (1024 * 1024)).toFixed(1)} MB`}
          />
        )}
        {total === 0 && (
          <div className="h-full w-full bg-transparent" />
        )}
      </div>

      {/* Legend */}
      <div className="space-y-2 text-[11px] font-mono">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5" style={{ color: "var(--info)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--info)" }} />
            <span>{t("disk_protected")}</span>
          </span>
          <span className="text-dim">
            {seg.protectedCount}x ({ (seg.sums.protected / (1024 * 1024)).toFixed(1) } MB)
          </span>
        </div>

        {seg.crashCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5" style={{ color: "var(--danger)" }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--danger)" }} />
              <span>{t("disk_crash")}</span>
            </span>
            <span className="text-dim">
              {seg.crashCount}x ({ (seg.sums.crash / (1024 * 1024)).toFixed(1) } MB)
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-dim">
            <span className="w-2 h-2 rounded-full bg-dim" />
            <span>{t("disk_pruneable")}</span>
          </span>
          <span className="text-dim">
            {seg.pruneCount}x ({ (seg.sums.prune / (1024 * 1024)).toFixed(1) } MB)
          </span>
        </div>
      </div>
    </div>
  );
};


/**
 * AutoSavePanel — inline auto-save settings on the Backups page.
 */
const AutoSavePanel = ({ server }) => {
  const { t } = useI18n();
  const automation = server.automation || {};
  const [enabled, setEnabled] = useState(automation.backup_enabled ?? true);
  const [interval, setIntervalMin] = useState(automation.backup_interval_min ?? 10);
  const [keep, setKeep] = useState(automation.backup_keep_count ?? 30);
  const [saving, setSaving] = useState(false);

  const dirty =
    enabled !== (automation.backup_enabled ?? true) ||
    interval !== (automation.backup_interval_min ?? 10) ||
    keep !== (automation.backup_keep_count ?? 30);

  const handleSave = async () => {
    setSaving(true);
    try {
      await endpoints.updateAutomation(server.id, {
        backup_enabled: enabled,
        backup_interval_min: interval,
        backup_keep_count: keep,
      });
      toast.success(t("toast_settings_saved"));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-surface/50 border border-brand p-5 rounded-xl shadow-lg relative overflow-hidden" data-testid="auto-save-panel">
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent-soft/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-accent-brand" />
          <span className="heading-stencil text-sm">{t("auto_backup_title")}</span>
        </div>
        
        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer select-none" data-testid="auto-backup-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-bg border border-brand/60 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-dim peer-checked:after:bg-accent-brand after:border-transparent after:border after:rounded-full after:h-[12px] after:w-[12px] after:transition-all peer-checked:bg-accent-soft/20 peer-checked:border-accent-brand"></div>
          <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-brand">{t("auto_backup_enabled")}</span>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label-overline block mb-1.5">{t("auto_backup_interval")}</label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={1440}
              className="input-field text-xs pr-12 w-full"
              value={interval}
              onChange={(e) => setIntervalMin(Math.max(1, parseInt(e.target.value || 10, 10)))}
              data-testid="auto-backup-interval-input"
            />
            <span className="absolute right-3 top-2.5 text-[9px] font-mono text-dim uppercase">Min</span>
          </div>
        </div>

        <div>
          <label className="label-overline block mb-1.5">{t("auto_backup_keep")}</label>
          <div className="relative">
            <input
              type="number"
              min={3}
              max={500}
              className="input-field text-xs pr-12 w-full"
              value={keep}
              onChange={(e) => setKeep(Math.max(3, parseInt(e.target.value || 30, 10)))}
              data-testid="auto-backup-keep-input"
            />
            <span className="absolute right-3 top-2.5 text-[9px] font-mono text-dim uppercase">Qty</span>
          </div>
        </div>

        <button
          className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
          onClick={handleSave}
          disabled={!dirty || saving}
          data-testid="auto-backup-save-btn"
        >
          <Save size={13} />
          {saving ? t("backup_creating") : t("save")}
        </button>
      </div>

      <p className="text-[9px] font-mono text-dim leading-relaxed flex items-start gap-1.5 mt-4 pt-3 border-t border-brand/40">
        <Info size={11} className="shrink-0 text-accent-brand mt-0.5" />
        {t("auto_backup_hint")}
      </p>
    </div>
  );
};



export const BackupsView = ({ servers = [], activeServerId, onSelectServer }) => {
  const { t } = useI18n();
  const [serverId, setServerId] = useState(activeServerId || servers[0]?.id || "");
  const [data, setData] = useState({ count: 0, total_size_mb: 0, backups: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);       // action in progress: "create" | "restore:<id>" | "delete:<id>"
  const [confirm, setConfirm] = useState(null); // {action, backup}

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

  const activeServer = useMemo(() => servers.find((s) => s.id === serverId), [servers, serverId]);
  const isRunning = activeServer?.status === "Running" || activeServer?.status === "Starting";

  const load = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const r = await endpoints.listBackups(serverId);
      setData(r);
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  const handleCreate = async () => {
    setBusy("create");
    try {
      const res = await endpoints.createBackup(serverId);
      toast.success(t("toast_backup_created"));
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setBusy(null); }
  };

  const handleRestore = async (b) => {
    setBusy(`restore:${b.id}`);
    try {
      await endpoints.restoreBackup(serverId, b.id);
      toast.success(t("toast_backup_restored"));
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setBusy(null); setConfirm(null); }
  };

  const handleDelete = async (b) => {
    setBusy(`delete:${b.id}`);
    try {
      await endpoints.deleteBackup(serverId, b.id);
      toast.success(t("toast_backup_deleted"));
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setBusy(null); setConfirm(null); }
  };

  if (!servers.length) {
    return (
      <div className="flex-1 p-12 text-center">
        <Archive size={48} className="mx-auto text-dim mb-4" />
        <h3 className="heading-stencil text-xl mb-2">{t("no_servers_yet")}</h3>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-deep overflow-hidden">
      {/* Top bar */}
      <div className="bg-surface border-b border-brand px-6 py-4 flex items-center gap-3 flex-wrap">
        <h2 className="heading-stencil text-lg flex items-center gap-2">
          <Archive size={16} className="text-accent-brand" />
          {t("nav_backups")}
        </h2>
        
        {/* Modern Active Server Badge (replacing the dropdown) */}
        <div className="flex items-center gap-2 px-3 py-1 bg-accent-soft border border-brand/50 text-accent-brand font-mono text-[10px] uppercase tracking-wider rounded-md">
          {activeServer?.name}
        </div>
        
        <div className="text-[10px] font-mono uppercase tracking-widest text-dim">
          <HardDrive size={11} className="inline mr-1" />
          {data.count} {t("backups_count")} · {data.total_size_mb} MB
        </div>
        <div className="flex-1" />
        <button
          className="btn-primary flex items-center gap-2"
          onClick={handleCreate}
          disabled={busy === "create"}
          data-testid="backup-create-btn"
        >
          <Save size={13} />
          {busy === "create" ? t("backup_creating") : t("backup_create_now")}
        </button>
        <button className="icon-btn" onClick={load} title={t("refresh_now")} data-testid="backups-refresh-btn">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Running-state warning strip */}
      {isRunning && (
        <div
          className="bg-surface border-b border-warning px-6 py-2 flex items-center gap-2 text-[11px] font-mono text-warning"
          data-testid="backups-running-warning"
        >
          <AlertTriangle size={12} />
          <span>{t("backups_running_warning")}</span>
        </div>
      )}

      {/* Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto scrollbar-thin bg-bg-deep">
        {/* Left Column (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          <DiskUsageStrip data={data} t={t} />
          {activeServer && (
            <AutoSavePanel
              key={activeServer.id}
              server={activeServer}
            />
          )}
        </div>

        {/* Right Column (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col bg-surface border border-brand rounded-xl shadow-xl overflow-hidden min-h-[400px]">
          <div className="border-b border-brand px-5 py-4 bg-bg flex items-center justify-between">
            <h3 className="heading-stencil text-sm flex items-center gap-2">
              <Archive size={14} className="text-accent-brand" />
              Yedek Geçmişi
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {data.backups.length === 0 ? (
              <div className="p-12 text-center h-full flex flex-col justify-center items-center">
                <Archive size={40} className="text-dim mb-4" />
                <h3 className="heading-stencil text-lg mb-2">{t("backups_empty_title")}</h3>
                <p className="text-xs text-dim max-w-md mx-auto leading-relaxed">{t("backups_empty_hint")}</p>
              </div>
            ) : (
              <table className="w-full text-xs font-mono" data-testid="backups-table">
                <thead className="bg-bg border-b border-brand sticky top-0 z-10">
                  <tr className="text-left text-dim">
                    <th className="label-overline px-4 py-3">{t("backup_col_created")}</th>
                    <th className="label-overline px-4 py-3">{t("backup_col_type")}</th>
                    <th className="label-overline px-4 py-3">{t("backup_col_filename")}</th>
                    <th className="label-overline px-4 py-3 text-right">{t("backup_col_size")}</th>
                    <th className="label-overline px-4 py-3 text-right">{t("backup_col_actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand/40">
                  {data.backups.map((b) => {
                    const meta = TYPE_META[b.backup_type] || TYPE_META.manual;
                    return (
                      <tr key={b.id} className="hover:bg-surface-2 transition-colors duration-150" data-testid={`backup-row-${b.id}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Clock size={10} className="inline mr-1.5 text-accent-brand" />
                          {fmtTs(b.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 border text-[9px] uppercase tracking-wider rounded"
                            style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}10` }}
                          >
                            {t(meta.label)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-dim truncate max-w-xs xl:max-w-md" title={b.filename}>{b.filename}</td>
                        <td className="px-4 py-3 text-right text-brand font-bold">{b.size_mb.toFixed(1)} MB</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <a
                              href={endpoints.downloadBackupUrl(serverId, b.id)}
                              className="icon-btn hover:text-accent-brand p-1.5 rounded-md hover:bg-bg transition-colors"
                              title={t("backup_download")}
                              data-testid={`backup-download-${b.id}`}
                            >
                              <Download size={12} />
                            </a>
                            <button
                              className="icon-btn hover:text-warning p-1.5 rounded-md hover:bg-bg transition-colors"
                              onClick={() => setConfirm({ action: "restore", backup: b })}
                              disabled={isRunning || busy !== null}
                              title={isRunning ? t("backups_running_warning") : t("backup_restore")}
                              data-testid={`backup-restore-${b.id}`}
                              style={{ color: "var(--warning)" }}
                            >
                              <Upload size={12} />
                            </button>
                            <button
                              className="icon-btn hover:text-danger p-1.5 rounded-md hover:bg-bg transition-colors"
                              onClick={() => setConfirm({ action: "delete", backup: b })}
                              disabled={busy !== null}
                              title={t("backup_delete")}
                              data-testid={`backup-delete-${b.id}`}
                              style={{ color: "var(--danger)" }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => !busy && setConfirm(null)}
          data-testid="backup-confirm-overlay"
        >
          <div
            className="bg-surface border border-brand p-6 max-w-md w-full mx-4 rounded-xl shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ borderColor: confirm.action === "restore" ? "var(--warning)" : "var(--danger)" }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent-soft/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="heading-stencil text-lg mb-3 flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: confirm.action === "restore" ? "var(--warning)" : "var(--danger)" }} />
              {confirm.action === "restore" ? t("backup_confirm_restore_title") : t("backup_confirm_delete_title")}
            </h3>
            <p className="text-xs text-dim mb-4 leading-relaxed">
              {confirm.action === "restore" ? t("backup_confirm_restore_body") : t("backup_confirm_delete_body")}
            </p>
            <div className="bg-bg/50 rounded-lg p-3.5 mb-5 font-mono text-[11px] border border-brand/60">
              <div className="text-brand font-bold break-all">{confirm.backup.filename}</div>
              <div className="text-dim mt-1.5 flex items-center gap-2">
                <span>{fmtTs(confirm.backup.created_at)}</span>
                <span>·</span>
                <span className="text-brand">{confirm.backup.size_mb.toFixed(1)} MB</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs px-4 py-2" onClick={() => setConfirm(null)} disabled={busy !== null}>
                {t("cancel")}
              </button>
              <button
                className={`${confirm.action === "restore" ? "btn-primary" : "btn-danger"} text-xs px-4 py-2`}
                onClick={() => (confirm.action === "restore" ? handleRestore(confirm.backup) : handleDelete(confirm.backup))}
                disabled={busy !== null}
                data-testid="backup-confirm-go"
              >
                {busy ? t("backup_working") : t("backup_confirm_go")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
