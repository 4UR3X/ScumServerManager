import React, { useEffect, useState } from "react";
import { X, Download, CheckCircle2, AlertCircle, RefreshCw, Rocket, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";

/**
 * ManagerUpdateModal — auto-updater UI (GitHub Releases).
 *
 * States: idle -> checking -> uptodate | available -> downloading -> ready
 * Quiet-error states: treat "latest.yml 404", "HTTP response not OK",
 * offline errors as "up-to-date" so the admin doesn't see scary GitHub
 * diagnostics while a release is still being uploaded.
 */
export const ManagerUpdateModal = ({ open, onClose }) => {
  const { t } = useI18n();
  const [state, setState] = useState("idle");
  const [info, setInfo] = useState({ currentVersion: "", latestVersion: "" });
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window?.lgss?.onUpdateEvent) return undefined;
    const off = window.lgss.onUpdateEvent((payload) => {
      if (payload.type === "available")        setState("available");
      else if (payload.type === "not-available") setState("uptodate");
      else if (payload.type === "progress")    setProgress(Math.round(payload.progress?.percent || 0));
      else if (payload.type === "downloaded")  setState("ready");
      else if (payload.type === "error")       { setState("error"); setError(payload.message); }
    });
    return off;
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setError(null); setProgress(0); setState("checking");
      if (!window?.lgss?.checkForUpdates) {
        // Browser / dev fallback
        const v = window?.lgss?.getVersion ? await window.lgss.getVersion() : "1.1.4";
        if (!alive) return;
        setInfo({ currentVersion: v, latestVersion: v });
        setState("uptodate");
        return;
      }
      const result = await window.lgss.checkForUpdates();
      if (!alive) return;
      setInfo({
        currentVersion: result.currentVersion || "?",
        latestVersion: result.latestVersion || result.currentVersion || "?",
      });
      // `result.quiet` is the main-process hint that the error was a
      // known-benign one (release still uploading, offline, etc.). We treat
      // it exactly like "up to date" so the admin doesn't see noise.
      if (!result.ok)                          { setState("error"); setError(result.error); }
      else if (result.updateAvailable)         setState("available");
      else                                     setState("uptodate");
    })();
    return () => { alive = false; };
  }, [open]);

  if (!open) return null;

  const startDownload = async () => {
    setState("downloading"); setProgress(0);
    const r = await window.lgss.downloadUpdate();
    if (!r?.ok) {
      if (r?.quiet) {
        // Release asset was withdrawn between check and download — treat as uptodate.
        setState("uptodate");
        setError(null);
      } else {
        setState("error");
        setError(r?.error || "download failed");
      }
    }
  };

  const installNow = async () => {
    toast(t("mu_restarting"));
    await window.lgss.installUpdate();
  };

  // Versions in a compact side-by-side card — much cleaner than two raw lines.
  const VersionCard = () => {
    const newer = info.latestVersion && info.latestVersion !== info.currentVersion && state === "available";
    return (
      <div className="flex items-center gap-3 w-full bg-surface-2/30 border border-brand/20 p-4 rounded-xl shadow-inner relative overflow-hidden">
        {/* Decorative Grid Line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/10 to-transparent" />
        
        <div className="flex-1 min-w-0">
          <div className="label-overline mb-1.5 text-dim text-[9px]">{t("mu_installed")}</div>
          <div className="font-mono text-lg font-bold text-brand leading-none">v{info.currentVersion || "?"}</div>
        </div>

        <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-bg/50 border border-brand/15">
          <ChevronRight size={16} className={newer ? "text-accent-brand animate-pulse" : "text-dim"} />
        </div>

        <div className="flex-1 min-w-0 text-right">
          <div className="label-overline mb-1.5 text-dim text-[9px]">{t("latest") || "Latest"}</div>
          <div className={`font-mono text-lg font-bold leading-none ${newer ? "text-accent-brand" : "text-brand"}`}>
            v{info.latestVersion || "?"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fadeIn" data-testid="manager-update-modal">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[520px] max-w-[94vw] border border-accent-brand/40 bg-surface/95 shadow-[0_0_40px_rgba(249,115,22,0.18)] backdrop-blur-md rounded-2xl flex flex-col overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand/50 bg-bg">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 flex items-center justify-center rounded-lg border border-accent-brand/30 bg-accent-brand/5 ${state === "available" ? "update-btn-pulse shadow-[0_0_8px_rgba(249,115,22,0.2)]" : ""}`}>
              <Package size={16} className="text-accent-brand" />
            </div>
            <div>
              <div className="label-accent text-[9px] leading-none tracking-widest text-accent-brand">LGSS MANAGER</div>
              <h3 className="heading-stencil text-base mt-1 text-brand">{t("mu_update_check")}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-dim hover:text-brand transition-colors" data-testid="update-modal-close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <VersionCard />

          {state === "checking" && (
            <StatusBlock
              icon={RefreshCw}
              spin
              title={t("mu_checking")}
              subtitle={t("mu_querying_github")}
            />
          )}

          {state === "uptodate" && (
            <StatusBlock
              icon={CheckCircle2}
              tone="ok"
              title={t("mu_up_to_date_title")}
              subtitle={t("mu_up_to_date_msg")}
            />
          )}

          {state === "available" && (
            <div className="space-y-4">
              <StatusBlock
                icon={Rocket}
                tone="accent"
                title={t("mu_ready_to_download", { version: info.latestVersion }) || `v${info.latestVersion} ready to download`}
                subtitle={t("mu_download_background")}
              />
              <button
                onClick={startDownload}
                className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 update-btn-pulse rounded-xl font-semibold tracking-wider transition-all"
                data-testid="update-download-btn"
              >
                <Download size={15} />
                {t("mu_download_update")}
              </button>
            </div>
          )}

          {state === "downloading" && (
            <div className="bg-surface-2/20 border border-brand/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-0.5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-accent-brand">
                  {t("mu_downloading")}
                </div>
                <div className="font-mono text-sm font-bold text-brand">{progress}%</div>
              </div>
              <div className="h-2 w-full bg-bg-deep rounded-full overflow-hidden border border-brand/10 relative">
                <div
                  className="absolute left-0 top-0 h-full transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%`, background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
                />
              </div>
              <p className="text-[10px] text-dim font-mono leading-relaxed">
                {t("mu_download_keep_using")}
              </p>
            </div>
          )}

          {state === "ready" && (
            <div className="space-y-4">
              <StatusBlock
                icon={CheckCircle2}
                tone="ok"
                title={t("mu_download_complete_title")}
                subtitle={t("mu_download_complete_msg")}
              />
              <button
                onClick={installNow}
                className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 update-btn-pulse rounded-xl font-semibold tracking-wider transition-all"
                data-testid="update-install-btn"
              >
                <Rocket size={15} />
                {t("mu_restart_install")}
              </button>
            </div>
          )}

          {state === "error" && (
            <StatusBlock
              icon={AlertCircle}
              tone="danger"
              title={t("mu_check_failed_title")}
              subtitle={error || t("mu_check_failed_msg")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const StatusBlock = ({ icon: Icon, title, subtitle, tone, spin }) => {
  const color =
    tone === "ok" ? "var(--success)"
    : tone === "danger" ? "var(--danger)"
    : tone === "accent" ? "var(--accent)"
    : "var(--text-muted)";
    
  const borderClass =
    tone === "ok" ? "border-success/35 bg-success/5"
    : tone === "danger" ? "border-danger/35 bg-danger/5"
    : tone === "accent" ? "border-accent-brand/35 bg-accent-soft/5"
    : "border-brand/20 bg-surface-2/30";

  return (
    <div className={`flex items-start gap-4 p-4 border rounded-xl shadow-sm transition-all duration-200 ${borderClass}`}>
      <div className="shrink-0 p-1 bg-bg-deep/60 rounded-lg border border-brand/10">
        <Icon size={18} className={`${spin ? "animate-spin" : ""}`} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="heading-stencil text-sm font-semibold tracking-wider" style={{ color }}>{title}</div>
        {subtitle && <div className="text-[11px] text-dim mt-1.5 leading-relaxed font-mono">{subtitle}</div>}
      </div>
    </div>
  );
};
