import React, { useState } from "react";
import {
  Palette, Languages, Check, Wrench, ShieldCheck, ShieldAlert,
  RotateCcw, LayoutDashboard, SlidersHorizontal, ScrollText, Users, Archive,
  Globe, X, Clock, MessageSquare, Key, ChevronRight
} from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";
import { useI18n, LANG_META } from "../providers/I18nProvider";


import { ConfirmModal } from "./ConfirmModal";
import { endpoints } from "../lib/api";

const themeLabels = {
  bunker: "theme_bunker",
  "neon-grid": "theme_neon-grid",
  carbon: "theme_carbon",
  toxic: "theme_toxic",
  inferno: "theme_inferno",
  "arctic-storm": "theme_arctic-storm",
  royal: "theme_royal",
  synthwave: "theme_synthwave",
  vortex: "theme_vortex",
  obsidian: "theme_obsidian",
};

const themeSwatches = {
  bunker:         ["#E65100", "#1E1E1E", "#F5F5F5"],
  "neon-grid":    ["#FF2DD1", "#14072A", "#F5E9FF"],
  carbon:         ["#FFB627", "#161618", "#ECECEE"],
  toxic:          ["#B6FF00", "#0B1A0E", "#E8FFD4"],
  inferno:        ["#FF3B1F", "#1B0908", "#FFE5DD"],
  "arctic-storm": ["#7DD3FC", "#0B1626", "#F0F8FF"],
  royal:          ["#D4AF37", "#141414", "#F5ECCC"],
  synthwave:      ["#FF4FB8", "#1B073D", "#FBE5FF"],
  vortex:         ["#00FFCC", "#0E0522", "#F0F4FF"],
  obsidian:       ["#FF1E27", "#121212", "#FFF0F2"],
};

export const Sidebar = ({
  isAdmin,
  servers = [],
  activeId,
  setActiveId,
  managerUpdateAvailable = false,
  managerPath,
  currentView = "dashboard",
  onNavigate,
  onResetSetup,
  onManagerUpdate,

}) => {
  const { theme, setTheme, themes } = useTheme();
  const { lang, setLang, t } = useI18n();
  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const [resetStep, setResetStep] = useState(0);
  const [selectOpen, setSelectOpen] = useState(false);

  const activeServer = servers.find((s) => s.id === activeId);

  const serverNavItems = [
    { key: "configs", label: t("nav_configs"), icon: SlidersHorizontal },
    { key: "automation", label: t("sec_automation"), icon: Clock },
    { key: "discord", label: t("sec_discord"), icon: MessageSquare },
    { key: "players", label: t("nav_players"), icon: Users },
    { key: "logs", label: t("nav_logs"), icon: ScrollText },
    { key: "backups", label: t("nav_backups"), icon: Archive },
  ];

  return (
    <aside className="w-72 bg-bg-deep border-r border-brand flex flex-col h-full shrink-0 select-none z-30 font-display" data-testid="sidebar">
      {/* Brand Header */}
      <div className="p-5 border-b border-brand flex items-center gap-3 bg-bg-deep/45">
        <div className="h-11 w-11 relative overflow-hidden flex items-center justify-center bg-bg-deep rounded-xl border border-brand/70 shadow-[0_0_10px_rgba(249,115,22,0.1)]">
          <img
            src={`${process.env.PUBLIC_URL || ""}/icon.png`}
            alt="LGSS"
            className="h-full w-full object-cover"
            draggable="false"
            onError={(e) => {
              if (!e.currentTarget.dataset.fallback) {
                e.currentTarget.dataset.fallback = "1";
                e.currentTarget.src = "./icon.png";
              }
            }}
          />
        </div>
        <div className="leading-none">
          <div className="font-mono text-[8px] font-extrabold tracking-[0.3em] text-accent-brand uppercase">
            LEGENDARY GAMING
          </div>
          <div className="heading-stencil text-sm text-brand mt-1 tracking-wider">
            SCUM MANAGER
          </div>
        </div>
      </div>

      {/* Dropdown Click Backdrop Overlay */}
      {selectOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSelectOpen(false)} />
      )}

      {/* Navigation & Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-6">
        {/* Global Navigation */}
        <div className="space-y-2">
          <button
            onClick={() => onNavigate?.("dashboard")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold tracking-widest uppercase border transition-all duration-200 ${
              currentView === "dashboard"
                ? "bg-gradient-to-r from-accent-brand/20 to-accent-soft/5 border-accent-brand/60 text-brand shadow-[0_0_15px_rgba(249,115,22,0.12)] pl-5"
                : "bg-surface-2/10 border-brand/10 text-text-dim hover:text-brand hover:border-brand/40 hover:bg-surface-2/30 hover:translate-x-1 pl-4"
            }`}
            data-testid="nav-dashboard-btn"
          >
            <LayoutDashboard size={15} className={currentView === "dashboard" ? "text-accent-brand drop-shadow-[0_0_4px_rgba(249,115,22,0.5)]" : "text-dim"} />
            <span>{t("nav_dashboard")}</span>
          </button>

          <button
            onClick={() => onNavigate?.("api")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold tracking-widest uppercase border transition-all duration-200 ${
              currentView === "api"
                ? "bg-gradient-to-r from-accent-brand/20 to-accent-soft/5 border-accent-brand/60 text-brand shadow-[0_0_15px_rgba(249,115,22,0.12)] pl-5"
                : "bg-surface-2/10 border-brand/10 text-text-dim hover:text-brand hover:border-brand/40 hover:bg-surface-2/30 hover:translate-x-1 pl-4"
            }`}
            data-testid="nav-api-btn"
          >
            <Key size={15} className={currentView === "api" ? "text-accent-brand drop-shadow-[0_0_4px_rgba(249,115,22,0.5)]" : "text-dim"} />
            <span>{t("nav_api_server")}</span>
          </button>
        </div>

        {/* Server Selection & Server Specific Nav */}
        <div className="space-y-4">
          <div className="px-4 text-[9px] uppercase font-mono tracking-[0.25em] text-accent-brand font-extrabold flex items-center gap-1.5 opacity-80">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-brand animate-pulse" />
            {t("servers") || "SUNUCULAR"}
          </div>

          {servers.length === 0 ? (
            <div className="px-4 py-2 text-xs text-dim italic">
              {t("no_servers") || "Sunucu yok"}
            </div>
          ) : (
            <div className="space-y-3 relative">
              {/* Premium Custom Server Selector dropdown */}
              <div className="px-2 z-50 relative">
                <button
                  type="button"
                  onClick={() => setSelectOpen(!selectOpen)}
                  className="w-full flex items-center justify-between bg-surface/80 border border-brand/40 text-brand px-3.5 py-3 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:border-accent-brand transition-all hover:bg-surface-2/80 shadow-md"
                  data-testid="sidebar-server-select"
                >
                  <span className="truncate pr-1">
                    {activeServer ? `${activeServer.name} (${activeServer.status})` : t("select_server")}
                  </span>
                  <ChevronRight size={14} className={`transform transition-transform ${selectOpen ? "rotate-90 text-accent-brand" : "text-dim"}`} />
                </button>

                {selectOpen && (
                  <div className="absolute left-2 right-2 mt-1 z-50 bg-surface/95 border border-brand/50 rounded-xl shadow-2xl py-1.5 max-h-[180px] overflow-y-auto scrollbar-thin backdrop-blur-md animate-fadeIn">
                    {servers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveId(s.id);
                          setSelectOpen(false);
                          if (currentView === "dashboard") {
                            onNavigate?.("configs");
                          }
                        }}
                        className={`w-full text-left px-3.5 py-3 text-xs font-mono transition-colors hover:bg-surface-2 flex items-center justify-between ${
                          s.id === activeId ? "text-accent-brand bg-accent-soft/15 font-semibold" : "text-brand"
                        }`}
                      >
                        <span className="truncate pr-2">{s.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                          s.status === "Running" ? "bg-success/15 text-success" : "bg-dim/15 text-dim"
                        }`}>
                          {s.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Server specific sub-navigation */}
              {activeServer && (
                <div className="pl-3.5 space-y-2 border-l border-brand/20 ml-5 animate-fadeIn">
                  {serverNavItems.map((n) => {
                    const Icon = n.icon;
                    const active = currentView === n.key;
                    const disabled = n.key === "configs" && !activeServer.installed;
                    
                    return (
                      <button
                        key={n.key}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          onNavigate?.(n.key);
                        }}
                        data-testid={`nav-${n.key}-btn`}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all duration-200 ${
                          disabled
                            ? "opacity-30 cursor-not-allowed text-text-muted"
                            : active
                            ? "bg-gradient-to-r from-accent-soft/40 to-transparent text-brand border-l-[3px] border-accent-brand font-bold shadow-[inset_2px_0_6px_rgba(249,115,22,0.1)] pl-4.5 rounded-r-md"
                            : "text-text-dim hover:text-brand hover:bg-surface/25 hover:translate-x-1 pl-3.5"
                        }`}
                      >
                        <Icon size={14} className={`${active ? "text-accent-brand drop-shadow-[0_0_5px_rgba(249,115,22,0.55)]" : "opacity-75"} transition-all`} />
                        <span>{n.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="p-4 border-t border-brand bg-bg-deep/80 space-y-3">
        {/* Version Info Centered and Highly Readable */}
        <div className="text-center font-mono text-[10px] font-bold tracking-widest text-accent-brand/85 uppercase py-1.5 bg-bg-deep/40 rounded-lg border border-brand/10 shadow-inner">
          v1.1.15
        </div>

        {/* Manager update banner */}
        <button
          className={`relative w-full flex items-center justify-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-all ${
            managerUpdateAvailable
              ? "border-accent-brand text-accent-brand update-btn-pulse"
              : "border-brand text-dim hover:text-brand hover:border-accent-brand/60"
          }`}
          onClick={onManagerUpdate}
          data-testid="manager-update-btn"
          title={managerUpdateAvailable ? t("manager_update_available") : t("manager_check_update")}
        >
          <Wrench size={12} className={managerUpdateAvailable ? "animate-spin-slow" : ""} />
          <span>{managerUpdateAvailable ? t("manager_update_available_short") : t("manager_update")}</span>
          {managerUpdateAvailable && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent-brand update-dot-pulse" />
          )}
        </button>

        {/* Quick Tools Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-2">
            <button
              className="p-1.5 rounded bg-surface hover:bg-surface-2 text-dim hover:text-brand border border-brand transition-colors"
              onClick={() => { setThemeOpen(true); setLangOpen(false); }}
              title={t("theme")}
              data-testid="theme-picker-btn"
            >
              <Palette size={14} />
            </button>
            <button
              className="p-1.5 rounded bg-surface hover:bg-surface-2 text-dim hover:text-brand border border-brand transition-colors"
              onClick={() => { setLangOpen(true); setThemeOpen(false); }}
              title={t("language")}
              data-testid="lang-picker-btn"
            >
              <Languages size={14} />
            </button>
            <button
              className="p-1.5 rounded bg-surface hover:bg-surface-2 text-dim hover:text-danger border border-brand transition-colors"
              onClick={() => setResetStep(1)}
              title={t("reset_setup_btn_title")}
              data-testid="reset-setup-btn"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <div className="flex gap-1.5">
            {/* Discord Link */}
            <button
              className="p-1.5 rounded bg-surface hover:bg-surface-2 text-dim hover:text-brand border border-brand transition-colors"
              title={t("open_discord")}
              onClick={() => window.open("https://discord.gg/ZBzTRNbTy3", "_blank", "noopener,noreferrer")}
              data-testid="topbar-discord-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </button>
            {/* Feedback Link */}
            <button
              className="p-1.5 rounded bg-surface hover:bg-surface-2 text-dim hover:text-brand border border-brand transition-colors"
              title={t("feedback")}
              onClick={() => window.open("https://legendaryhub.vip/", "_blank", "noopener,noreferrer")}
              data-testid="topbar-feedback-btn"
            >
              <Globe size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Theme Picker Modal */}
      {themeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fadeIn" data-testid="theme-modal">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setThemeOpen(false)} />
          <div className="relative bg-surface/95 border border-accent-brand/40 shadow-[0_0_30px_rgba(249,115,22,0.15)] w-[480px] max-w-[92vw] max-h-[85vh] overflow-y-auto scrollbar-thin rounded-xl flex flex-col">
            <div className="label-accent px-5 py-4 border-b border-brand/50 sticky top-0 bg-surface flex items-center justify-between z-10">
              <span className="flex items-center gap-2 text-brand">
                <Palette size={16} className="text-accent-brand" />
                {t("theme")}
              </span>
              <button onClick={() => setThemeOpen(false)} className="text-dim hover:text-brand transition-colors" data-testid="theme-modal-close">
                <X size={15} />
              </button>
            </div>
            
            {/* 2-column Theme Card Grid */}
            <div className="p-4 grid grid-cols-2 gap-3 max-h-[420px] overflow-y-auto scrollbar-thin">
              {themes.map((tKey) => {
                const sw = themeSwatches[tKey] || ["#888", "#222", "#eee"];
                const active = theme === tKey;
                return (
                  <button
                    key={tKey}
                    onClick={() => { setTheme(tKey); setThemeOpen(false); }}
                    data-testid={`theme-option-${tKey}`}
                    className={`group flex flex-col p-3 rounded-lg border text-left transition-all ${
                      active
                        ? "bg-accent-soft/25 border-accent-brand shadow-[0_0_12px_rgba(249,115,22,0.1)]"
                        : "bg-surface-2/40 border-brand/20 hover:border-brand hover:bg-surface-2/80 hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Visual Color Palette Preview Strip */}
                    <div className="flex h-5 w-full rounded overflow-hidden border border-brand/10 mb-2.5 relative shadow-inner">
                      <div className="h-full flex-1" style={{ background: sw[0] }} title="Primary" />
                      <div className="h-full flex-1" style={{ background: sw[1] }} title="Secondary" />
                      <div className="h-full flex-1" style={{ background: sw[2] }} title="Accent" />
                    </div>

                    <div className="flex items-center justify-between w-full min-w-0 mt-0.5">
                      <span className="text-xs font-semibold text-brand truncate">
                        {t(themeLabels[tKey]) || tKey.toUpperCase()}
                      </span>
                      {active && (
                        <div className="w-4 h-4 rounded-full bg-accent-brand flex items-center justify-center shrink-0">
                          <Check size={10} className="text-bg-solid" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Language Picker Modal */}
      {langOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fadeIn" data-testid="lang-modal">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setLangOpen(false)} />
          <div className="relative bg-surface/95 border border-accent-brand/40 shadow-[0_0_30px_rgba(249,115,22,0.15)] w-[520px] max-w-[92vw] max-h-[85vh] overflow-y-auto scrollbar-thin rounded-xl flex flex-col">
            <div className="label-accent px-5 py-4 border-b border-brand/50 sticky top-0 bg-surface flex items-center justify-between z-10">
              <span className="flex items-center gap-2 text-brand">
                <Globe size={16} className="text-accent-brand" />
                {t("language")}
              </span>
              <button onClick={() => setLangOpen(false)} className="text-dim hover:text-brand transition-colors" data-testid="lang-modal-close">
                <X size={15} />
              </button>
            </div>
            
            {/* 2-column Modern Card Grid */}
            <div className="p-4 grid grid-cols-2 gap-2 max-h-[380px] overflow-y-auto scrollbar-thin">
              {Object.entries(LANG_META).map(([code, meta]) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangOpen(false); }}
                    data-testid={`lang-option-${code}`}
                    className={`group flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                      active
                        ? "bg-accent-soft/25 border-accent-brand shadow-[0_0_12px_rgba(249,115,22,0.1)]"
                        : "bg-surface-2/40 border-brand/20 hover:border-brand hover:bg-surface-2/80 hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Glowing Flag Circle */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${
                      active ? "bg-accent-brand/10 shadow-[0_0_8px_rgba(249,115,22,0.2)]" : "bg-bg-deep"
                    }`}>
                      {meta.flag || <Globe size={16} className="text-accent-brand" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[9px] font-extrabold tracking-wider text-accent-brand bg-accent-brand/10 border border-accent-brand/20 px-1 py-0.5 rounded-sm shrink-0">
                          {code.toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-brand truncate">
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-[9px] text-dim font-mono tracking-tight leading-snug truncate">
                        {meta.translator}
                      </div>
                      <div className="text-[8px] text-dim opacity-70 font-mono tracking-normal mt-0.5">
                        {meta.date}
                      </div>
                    </div>

                    {active && (
                      <div className="w-4.5 h-4.5 rounded-full bg-accent-brand flex items-center justify-center shrink-0 self-center">
                        <Check size={11} className="text-bg-solid font-bold" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
              </div>
            </div>
      )}

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        open={resetStep === 1}
        title={t("reset_setup_title")}
        body={t("reset_setup_body_1")}
        confirmLabel={t("reset_setup_continue")}
        cancelLabel={t("cancel") || "Iptal"}
        onConfirm={() => setResetStep(2)}
        onCancel={() => setResetStep(0)}
        destructive={true}
        testId="reset-setup-confirm-1"
      />
      <ConfirmModal
        open={resetStep === 2}
        title={t("reset_setup_final_title")}
        body={t("reset_setup_body_2")}
        confirmLabel={t("reset_setup_confirm_final")}
        cancelLabel={t("cancel") || "Iptal"}
        onConfirm={async () => {
          setResetStep(0);
          try {
            await endpoints.resetSetup();
            onResetSetup?.();
          } catch {}
        }}
        onCancel={() => setResetStep(0)}
        destructive={true}
        testId="reset-setup-confirm-2"
      />
    </aside>
  );
};
