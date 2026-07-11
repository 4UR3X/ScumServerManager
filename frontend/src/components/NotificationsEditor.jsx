import React from "react";
import { Trash2, Plus } from "lucide-react";
import { useI18n } from "../providers/I18nProvider";

/**
 * NotificationsEditor — edits entries of SCUM Notifications.json.
 *
 * Fields exposed per row:
 *  - message   : the text shown in-game
 *  - duration  : how long (seconds) the banner stays on screen. Defaults to
 *                10s, which is SCUM's sweet spot: long enough to read, short
 *                enough to not obscure gameplay.
 *
 * The legacy `interval-minutes` key (periodic broadcast) is preserved if
 * present in incoming data, but is not editable in the UI right now —
 * restart/update warnings are time-triggered, not interval-triggered.
 */
export const NotificationsEditor = ({ entries = [], onChange, testId = "notifications", kind = null }) => {
  const { t } = useI18n();
  const makeSeed = (msg) => ({ message: msg, duration: "5" });

  // "Add" button seed — a reasonable placeholder for the current kind so the
  // admin doesn't start from a blank line.
  const addSeed = kind === "update"
    ? makeSeed("Update available — server will restart soon.")
    : makeSeed("Welcome to the server!");

  const add = () => onChange([...entries, addSeed]);
  const update = (idx, patch) => onChange(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  const remove = (idx) => onChange(entries.filter((_, i) => i !== idx));

  const handleCustomTextChange = (idx, newText, placeholderStr) => {
    const message = `${newText}${placeholderStr}`;
    
    // Auto-sync custom text across all entries sharing the exact same placeholder (e.g. midnight splits)
    const updated = entries.map((e, i) => {
      if (i === idx) return { ...e, message };
      if (placeholderStr && e.message && e.message.includes(placeholderStr)) {
        return { ...e, message };
      }
      return e;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex justify-end">
        <button className="tactical-btn flex items-center gap-2" onClick={add} data-testid={`${testId}-add`}>
          <Plus size={14} /> {t("add_notification")}
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="panel p-6 text-center text-sm text-dim">{t("no_notifications")}</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e, idx) => {
            const rawMsg = e.message || "";
            const match = rawMsg.match(/(#RestartIn\(\d{2}:\d{2}\))/);
            const isRestart = e.kind === "restart" || !!match;
            const placeholder = match ? match[1] : "";
            const pIdx = placeholder ? rawMsg.lastIndexOf(placeholder) : -1;
            const customText = pIdx >= 0 ? rawMsg.substring(0, pIdx) : rawMsg;

            return (
              <div key={idx} className="panel p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="label-overline block mb-1">{t("notification_message")}</label>
                    {isRestart ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          className="input-field flex-1 font-mono text-xs"
                          placeholder={t("notification_message_placeholder") || "e.g., Server restart in"}
                          value={customText}
                          onChange={(ev) => handleCustomTextChange(idx, ev.target.value, placeholder || `#RestartIn(12:00)`)}
                          data-testid={`${testId}-row-${idx}-message-input`}
                        />
                        {placeholder && (
                          <span className="bg-accent-soft/20 text-accent-brand border border-accent-brand/20 px-3 py-2 rounded-xl font-mono text-[10px] select-none font-bold uppercase tracking-wider shadow-sm shrink-0">
                            {placeholder}
                          </span>
                        )}
                      </div>
                    ) : (
                      <textarea
                        rows={2}
                        className="input-field font-mono text-xs"
                        value={e.message || ""}
                        onChange={(ev) => update(idx, { message: ev.target.value })}
                        data-testid={`${testId}-row-${idx}-message`}
                      />
                    )}
                  </div>
                  <div className="w-40">
                    <label className="label-overline block mb-1">{t("notification_duration")}</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      className="input-field font-mono"
                      value={parseInt(e.duration, 10) || 5}
                      onChange={(ev) => update(idx, { duration: String(Math.max(1, Number(ev.target.value) || 5)) })}
                      data-testid={`${testId}-row-${idx}-duration`}
                    />
                    <p className="text-[10px] text-dim mt-1">{t("notification_duration_hint")}</p>
                  </div>
                  <button className="icon-btn mt-6 text-danger" onClick={() => remove(idx)} data-testid={`${testId}-row-${idx}-remove`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
