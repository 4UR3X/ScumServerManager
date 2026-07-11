import React, { useEffect, useRef, useState } from "react";
import { X, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { endpoints } from "../lib/api";
import { useI18n } from "../providers/I18nProvider";

/**
 * InstallProgressModal
 * Polls /install/progress every 1.2s while visible. Auto-closes on 'complete'.
 * Props:
 *  - open: boolean
 *  - server: {id, name, folder_path}
 *  - onClose: () => void
 *  - onDone: (success:boolean) => void   // parent refetches server state
 */
export const InstallProgressModal = ({ open, server, onClose, onDone, mode = "install" }) => {
  const { t } = useI18n();
  const serverId = server?.id;
  const [state, setState] = useState({ percent: 0, phase: "starting", running: true, log_tail: "", error: null });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const logRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!open || !serverId) return;
    let alive = true;
    let id = null;
    doneRef.current = false;
    const poll = async () => {
      try {
        const s = await endpoints.installProgress(serverId);
        if (!alive) return;
        setState(s);
        if (!s.running) {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone?.(s.phase === "complete");
          }
          if (id) clearInterval(id);
          // leave modal open briefly so user sees 100% / error
        }
      } catch {}
    };
    poll();
    id = setInterval(poll, 400);
    return () => { alive = false; clearInterval(id); };
  }, [open, serverId, onDone]);

  // auto-scroll log tail
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.log_tail]);

  if (!open || !server) return null;

  const finished = !state.running;
  const success = state.phase === "complete";
  const hasError = !!state.error;

  const handleCancelClick = () => {
    setConfirmCancel(true);
  };

  const confirmCancelAction = async () => {
    try {
      await endpoints.abortInstall(server.id);
    } catch {}
    setConfirmCancel(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" data-testid="install-progress-modal">
      <div className="absolute inset-0 bg-black/80" onClick={finished ? onClose : undefined} />
      
      <div className="relative w-[640px] max-w-full border border-brand/40 bg-bg-deep/95 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-md animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand/20 bg-bg/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-soft/20 text-accent-brand rounded-xl border border-accent-brand/20 shadow-[0_0_8px_rgba(249,115,22,0.1)]">
              <Download size={16} />
            </div>
            <div>
              <div className="label-accent text-[10px] tracking-[0.2em] font-extrabold uppercase leading-none opacity-85">
                {mode === "update" ? (t("update_server") || "UPDATE SERVER") : (t("install_server") || "INSTALL SERVER")}
              </div>
              <h3 className="heading-stencil text-base mt-1 text-text">{server.name}</h3>
            </div>
          </div>
          <button
            onClick={finished ? onClose : handleCancelClick}
            className="icon-btn hover:text-accent-brand hover:bg-surface/30 p-1.5 rounded-lg transition-all"
            data-testid="install-modal-close-btn"
            title={finished ? t("ip_close") : t("ip_abort") || "Abort Installation"}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Progress bar */}
          <div className="bg-surface/30 border border-brand/10 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono text-[10px] text-dim uppercase tracking-[0.25em] font-bold">
                {t(`install_phase_${state.phase || "starting"}`)?.startsWith("install_phase_")
                  ? (state.phase?.toUpperCase() || "INITIALIZING")
                  : t(`install_phase_${state.phase || "starting"}`)}
              </div>
              <div className="font-mono text-sm font-bold text-accent-brand">
                {state.percent?.toFixed(1) ?? "0.0"}%
              </div>
            </div>
            <div className="h-2.5 w-full bg-bg border border-brand/20 rounded-full relative overflow-hidden shadow-inner">
              <div
                className="absolute left-0 top-0 h-full transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.25)]"
                style={{
                  width: `${Math.min(100, state.percent || 0)}%`,
                  background: success ? "var(--success)" : hasError ? "var(--danger)" : "var(--accent)",
                }}
              />
            </div>
            {state.phase === "first_boot" && (
              <div className="mt-2 font-mono text-[10px] text-dim leading-relaxed">
                {t("first_boot_generating")}
              </div>
            )}
          </div>

          {/* Status Alert Cards */}
          {finished && success && (
            <div className="flex items-center gap-2.5 text-xs font-semibold px-4 py-3 bg-success/10 text-success border border-success/20 rounded-xl">
              <CheckCircle2 size={15} />
              <span>
                {mode === "update"
                  ? (t("toast_update_done") || "Update complete — server ready to start.")
                  : (t("install_complete_msg") || "Install complete — server ready to start.")}
              </span>
            </div>
          )}
          {finished && hasError && (
            <div className="flex items-center gap-2.5 text-xs font-semibold px-4 py-3 bg-danger/10 text-danger border border-danger/20 rounded-xl">
              <AlertTriangle size={15} />
              <span className="break-all">{state.error}</span>
            </div>
          )}

          {/* Log tail */}
          <div className="space-y-1.5">
            <div className="label-overline text-[9px] tracking-widest font-extrabold text-muted">SteamCMD Log</div>
            <div className="border border-brand/20 rounded-xl overflow-hidden bg-black/60 shadow-inner">
              <pre
                ref={logRef}
                className="font-mono text-[10px] leading-relaxed text-dim p-4 h-[210px] overflow-y-auto scrollbar-thin whitespace-pre-wrap"
                data-testid="install-log-tail"
              >
                {state.log_tail || "Waiting..."}
              </pre>
            </div>
          </div>

          {/* Cancel button at bottom during progress */}
          {!finished && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleCancelClick}
                className="px-4 py-2.5 bg-danger/10 hover:bg-danger/25 text-danger border border-danger/25 hover:border-danger/60 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200"
              >
                {t("cancel_download") || "CANCEL DOWNLOAD"}
              </button>
            </div>
          )}
        </div>

        {/* Confirmation Modal Overlay inside the dialog */}
        {confirmCancel && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="w-[400px] border border-danger/35 bg-bg-deep/95 p-6 rounded-2xl shadow-2xl text-center space-y-5 animate-scaleUp">
              <div className="mx-auto w-12 h-12 bg-danger/10 text-danger border border-danger/25 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.1)]">
                <AlertTriangle size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-sm uppercase tracking-wider text-text">
                  {t("abort_confirm_title") || "ABORT DOWNLOAD?"}
                </h4>
                <p className="text-[11px] text-dim leading-relaxed px-2">
                  {t("abort_confirm_desc") || "Are you sure you want to stop downloading server files? This will cancel the installation / update."}
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="px-4 py-2 bg-surface hover:bg-surface-2 border border-brand/20 rounded-xl text-xs font-bold text-brand tracking-wider transition-colors uppercase"
                >
                  {t("no_continue") || "NO, CONTINUE"}
                </button>
                <button
                  type="button"
                  onClick={confirmCancelAction}
                  className="px-4 py-2 bg-danger hover:bg-danger/80 border border-danger/30 text-text rounded-xl text-xs font-bold tracking-wider transition-colors uppercase shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                >
                  {t("yes_abort") || "YES, ABORT"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
