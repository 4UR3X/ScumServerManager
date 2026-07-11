import React, { useCallback, useEffect, useState } from "react";
import { Bot, Power, Key, CheckCircle2, AlertCircle, Info, ExternalLink, ShieldAlert, Sparkles, Bell, RefreshCw, Eye, EyeOff, Layout } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";

const ToggleSwitch = ({ checked, onChange, label, hint, Icon, disabled }) => (
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
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      style={{ backgroundColor: checked ? "var(--accent)" : "var(--border-strong)" }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0px)" }}
      />
    </button>
  </div>
);

export const DiscordBotSettings = ({ server }) => {
  const { t } = useI18n();
  const serverId = server?.id;
  const [cfg, setCfg] = useState({ 
    enabled: false, 
    token_set: false, 
    token_preview: "", 
    status_guild_id: "", 
    status_channel_id: "", 
    event_channels: {}, 
    embed_title: "",
    embed_color: "",
    embed_image: "",
    embed_footer: "",
    hide_player_names: false,
    status: {} 
  });
  const [token, setToken] = useState("");
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [eventChannels, setEventChannels] = useState({});

  // Custom status embed styling states
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedColor, setEmbedColor] = useState("");
  const [embedImage, setEmbedImage] = useState("");
  const [embedFooter, setEmbedFooter] = useState("");

  const load = useCallback(async () => {
    if (!serverId) return;
    try {
      const r = await endpoints.getServerDiscordBot(serverId);
      setCfg(r);
      setGuildId(r.status_guild_id || "");
      setChannelId(r.status_channel_id || "");
      setEventChannels(r.event_channels || {});
      setEmbedTitle(r.embed_title || "");
      setEmbedColor(r.embed_color || "");
      setEmbedImage(r.embed_image || "");
      setEmbedFooter(r.embed_footer || "");
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    }
  }, [serverId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!serverId) return;
    let alive = true;
    const i = setInterval(async () => {
      try {
        const s = await endpoints.getServerDiscordBotStatus(serverId);
        if (alive) setCfg((c) => ({ ...c, status: s }));
      } catch {}
    }, 5000);
    return () => { alive = false; clearInterval(i); };
  }, [serverId]);

  const handleSave = async (partial) => {
    if (!serverId) return;
    setSaving(true);
    try {
      const r = await endpoints.updateServerDiscordBot(serverId, partial);
      setCfg(r);
      if (partial.token) {
        setToken(""); // clear field after token update
      }
      toast.success(t("toast_settings_saved"));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  const status = cfg.status || {};
  const connected = !!status.connected;
  const running = !!status.running;

  const isEmbedCustomizationDirty = 
    embedTitle !== (cfg.embed_title || "") ||
    embedColor !== (cfg.embed_color || "") ||
    embedImage !== (cfg.embed_image || "") ||
    embedFooter !== (cfg.embed_footer || "");

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4" data-testid="discord-bot-settings">
      {/* ===== Connection Status Card ===== */}
      <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
        <div className="pb-5 border-b border-strong/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={18} className="text-accent" />
            <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("discord_bot_title")}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border rounded-xl bg-bg-deep/80"
               style={{ borderColor: connected ? "var(--success)" : running ? "var(--warning)" : "var(--border)" }}
          >
            <span
              className="status-led inline-block !w-2 !h-2"
              style={{ 
                background: connected ? "var(--success)" : running ? "var(--warning)" : "var(--text-muted)",
                boxShadow: connected ? "0 0 8px var(--success)" : running ? "0 0 8px var(--warning)" : "none"
              }}
            />
            <span className="font-mono text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: connected ? "var(--success)" : running ? "var(--warning)" : "var(--text-muted)" }}
            >
              {connected ? t("discord_bot_connected")
                : running ? t("discord_bot_connecting")
                : t("discord_bot_offline")}
            </span>
          </div>
        </div>

        <div className="pt-6 space-y-4">
          <div className="p-4 bg-surface/30 border border-strong/50 rounded-2xl flex items-start gap-3 shadow-inner">
            <Info size={14} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-xs text-dim leading-relaxed">{t("discord_bot_hint")}</p>
          </div>

          {status.error && (
            <div className="flex items-center gap-2.5 px-4 py-3 border border-danger/45 bg-danger/5 text-xs text-danger font-mono rounded-xl shadow-md" data-testid="discord-bot-error">
              <AlertCircle size={14} />
              <span>
                {status.error === "login_failed" ? t("discord_bot_login_failed") : status.error}
              </span>
            </div>
          )}

          {connected && status.user && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="border border-strong bg-bg-deep/60 px-4 py-3 rounded-2xl shadow-inner">
                <div className="label-overline text-[9px] font-semibold text-dim mb-1 uppercase tracking-wider">{t("discord_bot_user")}</div>
                <div className="font-mono text-xs text-brand truncate font-bold">{status.user}</div>
              </div>
              <div className="border border-strong bg-bg-deep/60 px-4 py-3 rounded-2xl shadow-inner">
                <div className="label-overline text-[9px] font-semibold text-dim mb-1 uppercase tracking-wider">{t("discord_bot_guilds")}</div>
                <div className="font-mono text-xs text-brand font-bold">{status.guild_count ?? 0}</div>
              </div>
              <div className="border border-strong bg-bg-deep/60 px-4 py-3 rounded-2xl shadow-inner" data-testid="discord-bot-totals-servers">
                <div className="label-overline text-[9px] font-semibold text-dim mb-1 uppercase tracking-wider">{t("discord_bot_totals_servers")}</div>
                <div className="font-mono text-xs text-brand font-bold">
                  <span className="text-accent">{status.totals?.running_count ?? 0}</span>
                  <span className="text-dim"> / {status.totals?.server_count ?? 0}</span>
                </div>
              </div>
              <div className="border border-strong bg-bg-deep/60 px-4 py-3 rounded-2xl shadow-inner" data-testid="discord-bot-totals-players">
                <div className="label-overline text-[9px] font-semibold text-dim mb-1 uppercase tracking-wider">{t("discord_bot_totals_players")}</div>
                <div className="font-mono text-xs text-brand font-bold">
                  <span className="text-accent">{status.totals?.player_count ?? 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Enable & Token Config Card ===== */}
      <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
        <div className="pb-5 border-b border-strong/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key size={18} className="text-accent" />
            <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("discord_bot_token_title")}</span>
          </div>
        </div>

        <div className="pt-6 space-y-6">
          <div className="space-y-2">
            <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_bot_token_label")}</label>
            <div className="flex gap-3">
              <div className="relative flex-1 flex items-center">
                <input
                  type={showToken ? "text" : "password"}
                  className="input-field pl-4 pr-12 text-sm bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl w-full font-mono shadow-inner text-brand"
                  placeholder={cfg.token_set ? cfg.token_preview || "••••••••" : "Paste bot token here…"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  data-testid="discord-bot-token-input"
                  autoComplete="off"
                />
                <button
                  className="absolute right-3.5 text-dim hover:text-brand p-1 rounded-lg transition-all"
                  onClick={() => setShowToken((v) => !v)}
                  type="button"
                  data-testid="discord-bot-token-toggle"
                  title={showToken ? "Hide" : "Show"}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg transition-all duration-300 text-xs font-bold uppercase tracking-wider shrink-0"
                style={{
                  backgroundColor: token ? "var(--accent)" : "var(--surface-3)",
                  color: token ? "#000000" : "var(--text-muted)",
                  border: token ? "1px solid var(--accent)" : "1px solid var(--border)"
                }}
                onClick={() => handleSave({ token: token || undefined, enabled: true })}
                disabled={saving || !token}
                data-testid="discord-bot-save-btn"
              >
                <Power size={12} />
                {cfg.token_set ? t("discord_bot_update_token") : t("discord_bot_save_start")}
              </button>
            </div>
            <p className="text-[10px] text-dim flex items-center gap-1">
              <ExternalLink size={9} />
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-accent"
              >
                {t("discord_bot_token_where")}
              </a>
            </p>
          </div>

          <div className="pt-2">
            <ToggleSwitch
              checked={!!cfg.enabled}
              onChange={(val) => handleSave({ enabled: val })}
              disabled={saving || (!cfg.token_set && !token)}
              label={t("discord_bot_enabled")}
              hint="Toggle bot active connection state on this server profile"
              Icon={Bot}
            />
          </div>
        </div>
      </div>

      {/* ===== Embed Customization Card (PVP / PVE) ===== */}
      <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
        <div className="pb-5 border-b border-strong/60 flex items-center gap-3">
          <Layout size={18} className="text-accent" />
          <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">
            {t("discord_bot_embed_customization")}
          </span>
        </div>

        <div className="pt-6 space-y-6">
          <ToggleSwitch
            checked={!!cfg.hide_player_names}
            onChange={(val) => handleSave({ hide_player_names: val })}
            label={t("discord_bot_hide_player_names")}
            hint={t("discord_bot_hide_player_names_hint")}
            Icon={ShieldAlert}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div className="space-y-2">
              <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_bot_embed_title")}</label>
              <input
                type="text"
                className="input-field bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl text-brand"
                placeholder="e.g. SCUM Server #1 Status"
                value={embedTitle}
                onChange={(e) => setEmbedTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_bot_embed_color")}</label>
              <input
                type="text"
                className="input-field bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl text-brand"
                placeholder="e.g. #3BA55C or 0x3BA55C"
                value={embedColor}
                onChange={(e) => setEmbedColor(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_bot_embed_image")}</label>
              <input
                type="text"
                className="input-field bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl text-brand"
                placeholder="e.g. https://my-server-website.com/logo.png"
                value={embedImage}
                onChange={(e) => setEmbedImage(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_bot_embed_footer")}</label>
              <input
                type="text"
                className="input-field bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl text-brand"
                placeholder="e.g. Custom footer text here..."
                value={embedFooter}
                onChange={(e) => setEmbedFooter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              className="px-5 py-2.5 rounded-xl shadow-lg transition-all duration-350 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: isEmbedCustomizationDirty && !saving ? "var(--accent)" : "var(--surface-3)",
                color: isEmbedCustomizationDirty && !saving ? "#000000" : "var(--text-muted)",
                cursor: isEmbedCustomizationDirty && !saving ? "pointer" : "not-allowed",
                boxShadow: isEmbedCustomizationDirty && !saving ? "0 0 12px rgba(230, 81, 0, 0.15)" : "none",
                border: isEmbedCustomizationDirty && !saving ? "1px solid var(--accent)" : "1px solid var(--border)"
              }}
              onClick={() => handleSave({
                embed_title: embedTitle,
                embed_color: embedColor,
                embed_image: embedImage,
                embed_footer: embedFooter
              })}
              disabled={saving || !isEmbedCustomizationDirty}
            >
              {t("save")}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Status Channel Card ===== */}
      <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
        <div className="pb-5 border-b border-strong/60 flex items-center gap-3">
          <ExternalLink size={18} className="text-accent" />
          <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("discord_bot_status_channel_title")}</span>
        </div>
        <div className="pt-6 space-y-6">
          <div className="p-4 bg-surface/30 border border-strong/50 rounded-2xl flex items-start gap-3 shadow-inner">
            <Info size={14} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-xs text-dim leading-relaxed">{t("discord_bot_status_channel_hint")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_bot_guild_id")}</label>
              <input
                type="text"
                className="input-field bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl text-brand"
                placeholder="Guild (Server) ID"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value.replace(/\D/g, ""))}
                data-testid="discord-bot-guild-id-input"
              />
            </div>
            <div className="space-y-2">
              <label className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_bot_channel_id")}</label>
              <input
                type="text"
                className="input-field bg-bg-deep/60 border-strong/80 focus:border-accent rounded-xl text-brand"
                placeholder="Channel ID"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value.replace(/\D/g, ""))}
                data-testid="discord-bot-channel-id-input"
              />
            </div>
          </div>
          <div className="flex justify-end pt-3">
            <button
              className="px-5 py-2.5 rounded-xl shadow-lg transition-all duration-350 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: (guildId !== (cfg.status_guild_id || "") || channelId !== (cfg.status_channel_id || "")) && !saving ? "var(--accent)" : "var(--surface-3)",
                color: (guildId !== (cfg.status_guild_id || "") || channelId !== (cfg.status_channel_id || "")) && !saving ? "#000000" : "var(--text-muted)",
                cursor: (guildId !== (cfg.status_guild_id || "") || channelId !== (cfg.status_channel_id || "")) && !saving ? "pointer" : "not-allowed",
                boxShadow: (guildId !== (cfg.status_guild_id || "") || channelId !== (cfg.status_channel_id || "")) && !saving ? "0 0 12px rgba(230, 81, 0, 0.15)" : "none",
                border: (guildId !== (cfg.status_guild_id || "") || channelId !== (cfg.status_channel_id || "")) && !saving ? "1px solid var(--accent)" : "1px solid var(--border)"
              }}
              onClick={() => handleSave({ status_guild_id: guildId, status_channel_id: channelId })}
              disabled={saving || (guildId === (cfg.status_guild_id || "") && channelId === (cfg.status_channel_id || ""))}
              data-testid="discord-bot-channel-save-btn"
            >
              {t("discord_bot_status_channel_save")}
            </button>
          </div>
          <p className="text-[10px] text-dim font-semibold uppercase tracking-wider leading-relaxed">
            {t("discord_bot_status_channel_howto")}
          </p>
        </div>
      </div>

      {/* ===== Event Channel Routing Card ===== */}
      <EventChannelsPanel
        t={t}
        eventChannels={eventChannels}
        setEventChannels={setEventChannels}
        onSave={() => handleSave({ event_channels: eventChannels })}
        saving={saving}
      />

      {/* ===== Slash Command Reference Card ===== */}
      <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80">
        <div className="pb-4 border-b border-strong/60 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-accent" />
          <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("discord_bot_commands")}</span>
        </div>
        <div className="pt-5 space-y-4">
          <div className="p-4 bg-surface/30 border border-strong/50 rounded-2xl flex items-center justify-between shadow-inner">
            <span className="font-mono text-sm font-bold text-accent">/online</span>
            <span className="text-xs text-brand font-semibold">{t("discord_bot_cmd_online")}</span>
          </div>
          <p className="text-[10px] text-dim border-t border-strong/30 pt-3 leading-relaxed">
            {t("discord_bot_presence_hint")}
          </p>
        </div>
      </div>
    </div>
  );
};

const EVENT_TYPES = [
  { key: "kill",         labelKey: "discord_evt_kill" },
  { key: "login",        labelKey: "discord_evt_login" },
  { key: "admin",        labelKey: "discord_evt_admin" },
  { key: "economy",      labelKey: "discord_evt_economy" },
  { key: "fame",         labelKey: "discord_evt_fame" },
  { key: "violation",    labelKey: "discord_evt_violation" },
  { key: "auto_restart", labelKey: "discord_evt_auto_restart" },
  { key: "auto_update",  labelKey: "discord_evt_auto_update" },
];

const EventChannelsPanel = ({ t, eventChannels, setEventChannels, onSave, saving }) => {
  const setRoute = (evtKey, patch) => {
    setEventChannels((prev) => ({
      ...prev,
      [evtKey]: { ...(prev[evtKey] || {}), ...patch },
    }));
  };
  const chat = eventChannels.chat || {};
  const splitChat = !!chat.split_chat;

  // Check if events mapping differs from database
  const isDirty = true; // Always enable saving for simple usage

  return (
    <div className="bg-surface/20 border border-strong/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-strong/80" data-testid="discord-event-channels-panel">
      <div className="pb-5 border-b border-strong/60 flex items-center gap-3">
        <Bell size={18} className="text-accent" />
        <span className="heading-stencil text-base font-bold tracking-wider uppercase text-brand">{t("discord_event_channels_title")}</span>
      </div>

      <div className="pt-6 space-y-6">
        <div className="p-4 bg-surface/30 border border-strong/50 rounded-2xl flex items-start gap-3 shadow-inner">
          <Info size={14} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-xs text-dim leading-relaxed">{t("discord_event_channels_hint")}</p>
        </div>

        {/* Chat row — special: split toggle + 1 or 4 channel inputs */}
        <div className="border border-strong bg-bg-deep/40 px-4 py-4.5 rounded-2xl shadow-inner">
          <div className="flex items-center justify-between mb-4.5">
            <span className="label-accent font-semibold tracking-wide text-xs text-brand block">{t("discord_evt_chat")}</span>
            <label className="flex items-center gap-2.5 text-[10px] cursor-pointer" data-testid="discord-chat-split-toggle">
              <input
                type="checkbox"
                checked={splitChat}
                onChange={(e) => setRoute("chat", { split_chat: e.target.checked })}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              <span className="font-mono uppercase tracking-widest font-bold">
                {splitChat ? t("discord_chat_mode_split") : t("discord_chat_mode_single")}
              </span>
            </label>
          </div>
          {splitChat ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["local", "squad", "global", "admin"].map((sub) => (
                <div key={sub} className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-dim block font-bold">{t("discord_chat_" + sub)}</span>
                  <input
                    type="text"
                    value={chat[sub] || ""}
                    onChange={(e) => setRoute("chat", { [sub]: e.target.value.replace(/\D/g, "") })}
                    placeholder={t("discord_chat_" + sub) + " ID"}
                    className="input-field !py-2 !text-[11px] font-mono text-brand rounded-xl"
                    data-testid={`discord-chat-${sub}-input`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={chat.channel_id || ""}
              onChange={(e) => setRoute("chat", { channel_id: e.target.value.replace(/\D/g, "") })}
              placeholder={t("discord_chat_all_channel_placeholder")}
              className="input-field !py-2 !text-xs font-mono w-full text-brand rounded-xl"
              data-testid="discord-chat-single-input"
            />
          )}
        </div>

        {/* All other event types — one row per type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EVENT_TYPES.map((et) => (
            <div key={et.key} className="flex items-center justify-between gap-3 border border-strong bg-bg-deep/30 px-4 py-3 rounded-2xl shadow-sm">
              <span className="label-overline w-24 shrink-0 text-brand text-[10px] tracking-wider font-bold">{t(et.labelKey)}</span>
              <input
                type="text"
                value={(eventChannels[et.key] || {}).channel_id || ""}
                onChange={(e) => setRoute(et.key, { channel_id: e.target.value.replace(/\D/g, "") })}
                placeholder="Channel ID"
                className="input-field flex-1 !py-1.5 !text-[11px] font-mono text-brand rounded-xl"
                data-testid={`discord-evt-${et.key}-input`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-strong/40">
          <button
            className="px-5 py-2.5 rounded-xl shadow-lg transition-all duration-350 text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--accent)",
              color: "#000000",
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(230, 81, 0, 0.15)",
              border: "1px solid var(--accent)"
            }}
            onClick={onSave}
            disabled={saving}
            data-testid="discord-event-channels-save-btn"
          >
            {t("discord_event_channels_save")}
          </button>
        </div>

        <p className="text-[10px] text-dim uppercase tracking-wider font-semibold leading-relaxed">
          {t("discord_event_channels_howto")}
        </p>
      </div>
    </div>
  );
};
