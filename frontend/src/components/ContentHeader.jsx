import React from "react";
import { HardDrive, Server, Activity, ShieldCheck, ShieldAlert } from "lucide-react";
import { useI18n } from "../providers/I18nProvider";

export const ContentHeader = ({
  isAdmin,
  activeServer,
  managerPath,
  runningCount,
  totalCount,
  currentView,
}) => {
  const { t } = useI18n();

  const viewTitles = {
    dashboard: t("nav_dashboard") || "GENEL DURUM",
    configs: t("nav_configs") || "SUNUCU AYARLARI",
    players: t("nav_players") || "OYUNCU LİSTESİ",
    logs: t("nav_logs") || "SİSTEM GÜNLÜKLERİ",
    backups: t("nav_backups") || "YEDEKLER",
  };

  return (
    <div className="bg-bg-deep border-b border-brand shrink-0 z-20" data-testid="content-header font-sans">
      {/* Top section: Title and Server info */}
      <div className="h-14 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm tracking-wider uppercase text-brand">
            {viewTitles[currentView] || currentView.toUpperCase()}
          </span>
          {activeServer && currentView !== "dashboard" && (
            <>
              <span className="text-muted text-xs">/</span>
              <span className="text-xs text-accent-brand uppercase tracking-wider font-bold">
                {activeServer.name}
              </span>
            </>
          )}
        </div>

        {/* Admin Badge */}
        <div className="flex items-center gap-2 px-3 py-1 border border-strong rounded-full text-[10px]" data-testid="admin-badge">
          {isAdmin ? (
            <ShieldCheck size={11} className="text-success" />
          ) : (
            <ShieldAlert size={11} className="text-warning" />
          )}
          <span className="uppercase tracking-widest text-[9px] font-semibold">
            {isAdmin ? t("admin_confirmed") : t("admin_not_confirmed")}
          </span>
        </div>
      </div>

      {/* Bottom section: Tactical HUD (Status Ribbon) */}
      <div className="h-9 border-t border-brand bg-bg flex items-center px-6 gap-6 text-[10px] text-dim animate-fadeIn" data-testid="status-ribbon">
        <div className="flex items-center gap-2">
          <span className="status-led running animate-pulse" />
          <span className="text-muted uppercase tracking-widest font-semibold">{t("network_live")}</span>
        </div>

        <div className="flex items-center gap-2">
          <HardDrive size={11} className="text-accent-brand" />
          <span className="text-muted uppercase tracking-widest font-semibold">{t("disk_connected")}:</span>
          <span className="text-brand truncate max-w-[200px] font-mono" title={managerPath}>
            {managerPath || "—"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Server size={11} className="text-accent-brand" />
          <span className="text-muted uppercase tracking-widest font-semibold">{t("fleet_total")}:</span>
          <span className="text-brand font-mono">{runningCount}/{totalCount}</span>
        </div>

        <div className="flex items-center gap-2">
          <Activity size={11} className="text-accent-brand" />
          <span className="text-muted uppercase tracking-widest font-semibold">{t("system_status")}:</span>
          <span className="text-success font-semibold">{t("ops_ready")}</span>
        </div>
      </div>
    </div>
  );
};
