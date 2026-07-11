import React, { useMemo, useState, useEffect } from "react";
import { Plus, Trash2, Clock, RefreshCw, CheckCircle2, AlertCircle, Sparkles, FileJson, Info, Bell, ShieldAlert, Cpu, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";
import { NotificationsEditor } from "./NotificationsEditor";

const isValidTime = (s) => /^\d{2}:\d{2}$/.test(s || "") && (() => {
  const [h, m] = s.split(":").map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
})();

const ToggleSwitch = ({ checked, onChange, label, hint, Icon }) => (
  <div className="flex items-center justify-between p-4.5 bg-surface/20 border border-strong/40 rounded-2xl hover:border-strong transition-all duration-300 shadow-md">
    <div className="flex items-start gap-4">
      {Icon && (
        <div 
          className="p-2.5 rounded-xl mt-0.5 shrink-0 transition-all duration-300"
          style={{ 
            backgroundColor: checked ? "var(--primary-soft)" : "var(--surface-3)", 
            color: checked ? "var(--primary)" : "var(--text-dim)" 
          }}
        >
          <Icon size={18} />
        </div>
      )}
      <div>
        <h4 className="text-sm font-semibold text-brand tracking-wide">{label}</h4>
        {hint && <p className="text-xs text-dim mt-1.5 max-w-xl leading-relaxed">{hint}</p>}
      </div>
    </div>
    <button 
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
      style={{ backgroundColor: checked ? "var(--accent)" : "var(--border-strong)" }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0px)" }}
      />
    </button>
  </div>
);

const TimeSlot = ({ value, onChange, onRemove, idx }) => (
  <div className="flex items-center gap-2.5 bg-bg-deep/80 border border-strong/60 hover:border-strong px-3 py-2 rounded-xl transition-all shadow-inner" data-testid={`restart-time-slot-${idx}`}>
    <Clock size={13} className="text-accent" />
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border-none text-brand font-mono text-sm focus:outline-none max-w-[80px]"
      data-testid={`restart-time-input-${idx}`}
    />
    <button className="text-dim hover:text-danger ml-1 p-0.5 hover:bg-surface/30 rounded-lg transition-all" onClick={onRemove} title="Remove" data-testid={`restart-time-remove-${idx}`}>
      <Trash2 size={13} />
    </button>
  </div>
);

export const AutomationEditor = ({ server, onChange, mode = "both" }) => {
  const { t } = useI18n();
  
  const automation = useMemo(() => server.automation || {}, [server.automation]);
  
  const [draft, setDraft] = useState({
    enabled: !!automation.enabled,
    restart_times: [...(automation.restart_times || [])],
    restart_days: Array.isArray(automation.restart_days) && automation.restart_days.length > 0
      ? [...automation.restart_days]
      : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    auto_update_enabled: !!automation.auto_update_enabled,
    update_check_interval_min: automation.update_check_interval_min ?? 360,
    timezone: "", // Clear timezone to always force host PC local time
    auto_restart_on_crash: automation.auto_restart_on_crash ?? true,
    keep_running: !!automation.keep_running,
  });
  
  const [draftNotifs, setDraftNotifs] = useState([...(server.settings?.notifications || [])]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [steamInfo, setSteamInfo] = useState({ latest_build_id: "—", checked_at: null });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setDraft({
      enabled: !!automation.enabled,
      restart_times: [...(automation.restart_times || [])],
      restart_days: Array.isArray(automation.restart_days) && automation.restart_days.length > 0
        ? [...automation.restart_days]
        : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      auto_update_enabled: !!automation.auto_update_enabled,
      update_check_interval_min: automation.update_check_interval_min ?? 360,
      timezone: "",
      auto_restart_on_crash: automation.auto_restart_on_crash ?? true,
      keep_running: !!automation.keep_running,
    });
    setDraftNotifs([...(server.settings?.notifications || [])]);
  }, [server.id]);

  const notificationsChanged = useMemo(() => {
    return JSON.stringify(server.settings?.notifications || []) !== JSON.stringify(draftNotifs);
  }, [server.settings?.notifications, draftNotifs]);

  const dirty = useMemo(() => {
    const { timezone: _t1, ...dbClean } = automation;
    const { timezone: _t2, ...draftClean } = draft;
    return JSON.stringify(dbClean) !== JSON.stringify(draftClean) || notificationsChanged;
  }, [automation, draft, notificationsChanged]);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const addTime = () => setField("restart_times", [...draft.restart_times, "06:00"]);
  const removeTime = (i) => setField("restart_times", draft.restart_times.filter((_, j) => j !== i));
  const updateTime = (i, v) => setField("restart_times", draft.restart_times.map((t, j) => (j === i ? v : t)));
  const clearTimes = () => setField("restart_times", []);

  const applyTemplate = (kind) => {
    if (kind === "every6h") setField("restart_times", ["00:00", "06:00", "12:00", "18:00"]);
    if (kind === "twiceDaily") setField("restart_times", ["06:00", "18:00"]);
  };

  const toggleDay = (code) => {
    const set = new Set(draft.restart_days);
    if (set.has(code)) set.delete(code); else set.add(code);
    setField("restart_days", Array.from(set));
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const payload = { ...draft, timezone: "" }; // Force clear timezone
      // 1. Save notifications list so that the backend generateNotifications picks up the latest custom prefixes!
      await endpoints.updateSettings(server.id, { notifications: draftNotifs });
      // 2. Save automation settings
      await endpoints.updateAutomation(server.id, payload);
      // 3. Regenerate and write Notifications.json to disk
      const finalDoc = await endpoints.generateNotifications(server.id);
      onChange?.(finalDoc);
      toast.success(t("toast_settings_saved"));
    } catch (e) {
      toast.error(String(e.response?.data?.detail || e.message));
    } finally { setBusy(false); }
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const info = await endpoints.steamCheckUpdate();
      setSteamInfo(info);
      toast.success(
        `${t("latest_build")}: ${info.latest_build_id.slice(0, 20)}`
      );
    } catch (e) {
      toast.error(String(e.response?.data?.detail || e.message));
    } finally { setChecking(false); }
  };

  const preview = draftNotifs;
  const invalidTimes = draft.restart_times.filter((x) => !isValidTime(x));

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4" data-testid={`automation-editor-${mode}`}>
      {/* ===== Restart Schedule ===== */}
      {mode !== "update" && (
        <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
          <div className="pb-5 border-b border-strong/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-accent" />
              <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("restart_schedule")}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-dim uppercase tracking-wider">{t("automation_enabled")}</span>
              <button 
                type="button"
                onClick={() => setField("enabled", !draft.enabled)}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                style={{ backgroundColor: draft.enabled ? "var(--accent)" : "var(--border-strong)" }}
              >
                <span
                  className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  style={{ transform: draft.enabled ? "translateX(20px)" : "translateX(0px)" }}
                />
              </button>
            </div>
          </div>

          <div className="pt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-dim" />
                  <label className="label-accent font-semibold tracking-wide text-xs text-brand">{t("restart_times")}</label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="text-[10px] text-dim hover:text-brand border border-strong/40 bg-surface/20 hover:bg-surface/60 px-2.5 py-1.5 rounded-lg hover:border-strong transition-all font-mono uppercase tracking-wider font-semibold" onClick={() => applyTemplate("twiceDaily")} data-testid="template-twice-daily-btn">
                    <Sparkles size={11} className="inline mr-1 text-accent" />
                    {t("apply_template_twice_daily")}
                  </button>
                  <button className="text-[10px] text-dim hover:text-brand border border-strong/40 bg-surface/20 hover:bg-surface/60 px-2.5 py-1.5 rounded-lg hover:border-strong transition-all font-mono uppercase tracking-wider font-semibold" onClick={() => applyTemplate("every6h")} data-testid="template-every-6h-btn">
                    <Sparkles size={11} className="inline mr-1 text-accent" />
                    {t("apply_template_daily_6h")}
                  </button>
                  {draft.restart_times.length > 0 && (
                    <button className="text-[10px] text-danger hover:text-danger-hover border border-danger/30 hover:border-danger bg-danger/5 hover:bg-danger/10 px-2.5 py-1.5 rounded-lg transition-all font-mono uppercase tracking-wider font-semibold" onClick={clearTimes} data-testid="clear-restart-times-btn">
                      {t("clear_restart_times")}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-dim leading-relaxed">{t("restart_times_hint")}</p>

              <div className="flex flex-wrap gap-3 p-4 bg-bg-deep/40 border border-strong/30 rounded-2xl">
                {draft.restart_times.map((val, idx) => (
                  <TimeSlot
                    key={idx}
                    value={val}
                    onChange={(v) => updateTime(idx, v)}
                    onRemove={() => removeTime(idx)}
                    idx={idx}
                  />
                ))}
                <button 
                  className="flex items-center gap-2 border border-strong hover:border-accent hover:text-accent rounded-xl px-4 py-2 transition-all duration-200 text-xs font-semibold bg-surface/20 hover:bg-surface/40" 
                  onClick={addTime} 
                  data-testid="add-restart-time-btn"
                >
                  <Plus size={14} /> {t("add_time_slot")}
                </button>
              </div>
              {invalidTimes.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-danger font-semibold">
                  <AlertCircle size={13} /> Invalid time(s): {invalidTimes.join(", ")}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-5 border-t border-strong/40">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-dim" />
                <label className="label-accent font-semibold tracking-wide text-xs text-brand">{t("restart_days_label")}</label>
              </div>
              <p className="text-xs text-dim leading-relaxed">{t("restart_days_hint")}</p>
              
              <div className="flex flex-wrap gap-2.5" data-testid="restart-days-row">
                {[
                  { code: "sun", label: t("dow_sun") },
                  { code: "mon", label: t("dow_mon") },
                  { code: "tue", label: t("dow_tue") },
                  { code: "wed", label: t("dow_wed") },
                  { code: "thu", label: t("dow_thu") },
                  { code: "fri", label: t("dow_fri") },
                  { code: "sat", label: t("dow_sat") },
                ].map((d) => {
                  const active = draft.restart_days.includes(d.code);
                  return (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => toggleDay(d.code)}
                      className="px-4 py-2.5 font-mono text-[11px] tracking-widest uppercase rounded-xl transition-all duration-200 border"
                      style={{
                        borderColor: active ? "var(--accent)" : "var(--border-strong)",
                        backgroundColor: active ? "var(--accent)" : "var(--bg-deep)",
                        color: active ? "#000000" : "var(--text-dim)",
                        fontWeight: active ? "700" : "400",
                        boxShadow: active ? "0 0 12px rgba(230, 81, 0, 0.25)" : "none"
                      }}
                      data-testid={`restart-day-${d.code}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {draft.restart_days.length === 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-danger font-semibold">
                  <AlertCircle size={13} /> {t("restart_days_empty_warning")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Crash & Auto-Start Settings ===== */}
      {mode !== "update" && (
        <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
          <div className="pb-4 border-b border-strong/60 flex items-center gap-3">
            <ShieldAlert size={18} className="text-accent" />
            <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("crash_autostart_settings")}</span>
          </div>

          <div className="pt-5 space-y-4">
            <ToggleSwitch
              checked={draft.auto_restart_on_crash}
              onChange={(v) => setField("auto_restart_on_crash", v)}
              label={t("auto_restart_on_crash_label")}
              hint={t("auto_restart_on_crash_hint")}
              Icon={ShieldAlert}
            />

            <ToggleSwitch
              checked={draft.keep_running}
              onChange={(v) => setField("keep_running", v)}
              label={t("keep_running_label")}
              hint={t("keep_running_hint")}
              Icon={Cpu}
            />
          </div>
        </div>
      )}

      {/* ===== Update Monitor ===== */}
      {mode !== "restart" && (
        <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
          <div className="pb-5 border-b border-strong/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="text-accent" />
              <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("update_monitor")}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-dim uppercase tracking-wider">{t("auto_update_enabled")}</span>
              <button 
                type="button"
                onClick={() => setField("auto_update_enabled", !draft.auto_update_enabled)}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                style={{ backgroundColor: draft.auto_update_enabled ? "var(--accent)" : "var(--border-strong)" }}
              >
                <span
                  className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  style={{ transform: draft.auto_update_enabled ? "translateX(20px)" : "translateX(0px)" }}
                />
              </button>
            </div>
          </div>

          <div className="pt-6 space-y-5">
            <div className="p-4.5 bg-surface/30 border border-strong/50 rounded-2xl flex items-start gap-3 shadow-inner">
              <Info size={14} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-xs text-dim leading-relaxed">{t("auto_update_hint")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("update_check_interval")}</label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    className="input-field !py-2.5 !pr-12 text-sm bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl w-full font-mono shadow-inner text-brand"
                    value={draft.update_check_interval_min}
                    onChange={(e) => setField("update_check_interval_min", Math.max(5, parseInt(e.target.value || 360, 10)))}
                    data-testid="update-check-interval-input"
                  />
                  <span className="absolute right-3.5 text-[10px] font-semibold text-dim uppercase tracking-wider select-none pointer-events-none">MIN</span>
                </div>
                <p className="text-[11px] text-dim leading-normal">{t("update_check_interval_hint")}</p>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div className="bg-surface/40 border border-strong/50 hover:border-strong rounded-2xl px-5 py-4 flex flex-col justify-between transition-all duration-300 shadow-md">
                  <div className="label-overline text-[10px] font-semibold tracking-widest text-dim uppercase mb-2">{t("server_build")}</div>
                  <div className="font-mono text-sm font-bold text-accent truncate" title={server.installed_build_id || "—"}>
                    {server.installed_build_id || "—"}
                  </div>
                </div>
                <div className="bg-surface/40 border border-strong/50 hover:border-strong rounded-2xl px-5 py-4 flex flex-col justify-between transition-all duration-300 shadow-md">
                  <div className="label-overline text-[10px] font-semibold tracking-widest text-dim uppercase mb-2">{t("latest_build")}</div>
                  <div className="font-mono text-sm font-bold text-accent truncate" title={steamInfo.latest_build_id}>
                    {steamInfo.latest_build_id}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-strong/40">
              <div className="flex items-center gap-3">
                <button
                  className="btn-secondary !py-2 !px-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all duration-200 border border-strong/60 bg-surface/30 hover:bg-surface/60"
                  onClick={handleCheckUpdate}
                  disabled={checking}
                  data-testid="check-update-now-btn"
                >
                  <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                  {t("check_now")}
                </button>

                {server.update_available ? (
                  <span className="flex items-center gap-2 px-3 py-1.5 border border-accent/40 text-accent font-mono text-[10px] uppercase tracking-widest rounded-xl bg-accent-soft">
                    <span className="status-led !w-2 !h-2" style={{ background: "var(--accent)" }} />
                    {t("update_available_label")}
                  </span>
                ) : server.installed ? (
                  <span className="flex items-center gap-1.5 text-success font-mono text-[10px] uppercase tracking-widest font-semibold">
                    <CheckCircle2 size={13} /> {t("up_to_date")}
                  </span>
                ) : null}
              </div>

              {steamInfo.checked_at && (
                <span className="font-mono text-[10px] text-dim uppercase tracking-wider">
                  {t("last_check")}: {new Date(steamInfo.checked_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Actions ===== */}
      <div className="flex items-center justify-end pt-2">
        <button
          className="flex items-center gap-2 px-6 py-3 rounded-xl shadow-lg transition-all duration-350 text-sm font-bold uppercase tracking-wider"
          style={{
            backgroundColor: dirty && !busy ? "var(--accent)" : "var(--surface-3)",
            color: dirty && !busy ? "#000000" : "var(--text-muted)",
            cursor: dirty && !busy ? "pointer" : "not-allowed",
            boxShadow: dirty && !busy ? "0 0 16px rgba(230, 81, 0, 0.2)" : "none",
            border: dirty && !busy ? "1px solid var(--accent)" : "1px solid var(--border)"
          }}
          onClick={handleSave}
          disabled={!dirty || busy}
          data-testid="save-automation-btn"
        >
          {t("save")}
        </button>
      </div>

      {/* ===== Inline Notifications Editor — RESTART ONLY ===== */}
      {mode === "restart" && (
        <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
          <div className="pb-4 border-b border-strong/60 flex items-center gap-3">
            <Bell size={18} className="text-accent" />
            <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">
              {t("restart_notifications_inline_title")}
            </span>
          </div>
          <div className="pt-5">
            <InlineKindNotifications
              serverId={server.id}
              all={preview}
              kind="restart"
              automation={{
                restart_times: draft.restart_times,
                pre_warning_minutes: draft.pre_warning_minutes,
              }}
              onChange={(newAll) => {
                setDraftNotifs(newAll);
              }}
            />
          </div>
        </div>
      )}

      {/* ===== Preview (restart-only, raw JSON for debugging) ===== */}
      {mode !== "update" && preview.length > 0 && (
        <div className="bg-surface/10 border border-strong/40 rounded-2xl overflow-hidden shadow-md p-4 transition-all duration-300 hover:border-strong/60">
          <div className="flex items-center justify-between pb-3 border-b border-strong/45">
            <div className="flex items-center gap-3">
              <FileJson size={14} className="text-accent" />
              <span className="heading-stencil text-xs font-semibold uppercase text-dim tracking-wider">{t("preview_notifications")} · Notifications.json</span>
              <span className="label-accent text-xs">({preview.length})</span>
            </div>
            <button className="btn-ghost !py-1 !px-2.5 text-[9px] uppercase tracking-widest font-bold border border-strong/45 rounded-lg" onClick={() => setShowPreview((v) => !v)} data-testid="toggle-preview-btn">
              {showPreview ? "HIDE" : "SHOW"}
            </button>
          </div>
          {showPreview && (
            <pre className="mt-3 p-3.5 text-[11px] font-mono text-dim leading-relaxed max-h-96 overflow-auto bg-bg-deep/60 border border-strong/30 rounded-xl shadow-inner">
{JSON.stringify({ Notifications: preview.map((n) => { const { kind, ...rest } = n; return rest; }) }, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

const InlineKindNotifications = ({ serverId, all = [], kind, automation, onChange }) => {
  const mine = all.filter((n) => (n?.kind || "restart") === kind);
  const others = all.filter((n) => (n?.kind || "restart") !== kind);

  return (
    <NotificationsEditor
      entries={mine}
      kind={kind}
      onChange={(list) => {
        const tagged = list.map((n) => ({ ...n, kind }));
        onChange([...others, ...tagged]);
      }}
      testId={`inline-notifications-${kind}`}
    />
  );
};
