import React, { useEffect, useState } from "react";
import {
  Settings, Activity, Key, Copy, Check, ExternalLink, Terminal,
  RefreshCw, ToggleLeft, ToggleRight, Info, Globe, Shield, Link2, Laptop,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";
import axios from "axios";

export const ApiView = () => {
  const { t } = useI18n();
  const [config, setConfig] = useState({
    api_enabled: false,
    api_port: 8002,
    api_username: "admin",
    api_password: "",
  });
  const [ips, setIps] = useState({ ip: "", local_ip: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test Console State
  const [testToken, setTestToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [consoleLoading, setConsoleLoading] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [setup, ipData] = await Promise.all([
        endpoints.getSetup(),
        endpoints.getPublicIp().catch(() => ({ ip: "—", local_ip: "—" })),
      ]);
      setConfig({
        api_enabled: setup.api_enabled ?? false,
        api_port: setup.api_port ?? 8002,
        api_username: setup.api_username ?? "admin",
        api_password: setup.api_password ?? "",
      });
      setIps(ipData);
    } catch (e) {
      toast.error("Failed to load API configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await endpoints.updateSetup(config);
      toast.success("API configuration updated successfully!");
      fetchConfig();
    } catch (e) {
      toast.error(String(e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const logToConsole = (type, message, data = null) => {
    const time = new Date().toLocaleTimeString();
    setConsoleLogs((prev) => [
      ...prev,
      { time, type, message, data: data ? JSON.stringify(data, null, 2) : null },
    ]);
  };

  const testGetToken = async () => {
    setConsoleLoading(true);
    setConsoleLogs([]);
    const apiUrl = `http://127.0.0.1:${config.api_port}/api/auth`;
    logToConsole("request", `POST ${apiUrl}`, {
      username: config.api_username,
      password: "••••••",
    });

    try {
      const res = await axios.post(apiUrl, {
        username: config.api_username,
        password: config.api_password,
      });
      if (res.data?.token) {
        setTestToken(res.data.token);
        logToConsole("success", "Authentication Successful! Token received.", res.data);
        toast.success("Token generated successfully!");
      } else {
        logToConsole("error", "No token returned in response.", res.data);
      }
    } catch (err) {
      logToConsole("error", `Authentication failed: ${err.message}`, err.response?.data || null);
      toast.error("Auth test failed. Ensure the server is enabled and running.");
    } finally {
      setConsoleLoading(false);
    }
  };

  const testGetServers = async () => {
    if (!testToken) {
      toast.error("Please generate a token first!");
      return;
    }
    setConsoleLoading(true);
    const apiUrl = `http://127.0.0.1:${config.api_port}/api/servers`;
    logToConsole("request", `GET ${apiUrl} (Authorization: Bearer ${testToken.substring(0, 15)}...)`);

    try {
      const res = await axios.get(apiUrl, {
        headers: { Authorization: `Bearer ${testToken}` },
      });
      logToConsole("success", "Successfully retrieved servers list!", res.data);
      toast.success("Server list fetched successfully!");
    } catch (err) {
      logToConsole("error", `Failed to get servers: ${err.message}`, err.response?.data || null);
      toast.error("Fetch failed.");
    } finally {
      setConsoleLoading(false);
    }
  };

  const localApiUrl = `http://${ips.local_ip || "localhost"}:${config.api_port}`;
  const wanApiUrl = ips.ip ? `http://${ips.ip}:${config.api_port}` : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg" data-testid="api-view">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-bg-deep/80 backdrop-blur-md border-b border-strong px-6 py-4 flex items-center gap-4 shrink-0">
        <Key size={18} className="text-accent-brand" />
        <div>
          <div className="label-accent">SETUP & CONFIGURATION</div>
          <div className="heading-stencil text-lg font-semibold">{t("nav_api_server")}</div>
        </div>
      </div>

      {/* ── Scrollable Body ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 flex flex-col gap-6 w-full max-w-full">
        {loading ? (
          <div className="p-8 text-center text-dim flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-accent-brand" />
            Loading API Configuration...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            
            {/* Left Column: Configuration Form & Network Details */}
            <div className="flex flex-col gap-6">
              <form onSubmit={handleSave} className="panel p-6 flex flex-col gap-5 relative overflow-hidden">
                <span
                  className="absolute left-0 top-0 right-0 h-[2px] bg-gradient-to-r from-accent-brand via-accent to-transparent"
                />
                
                <div className="flex items-center justify-between pb-3 border-b border-brand">
                  <div className="flex items-center gap-2">
                    <Settings size={15} className="text-accent-brand" />
                    <span className="heading-stencil text-xs">{t("api_settings")}</span>
                  </div>
                  
                  {/* Status Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, api_enabled: !prev.api_enabled }))}
                    className="flex items-center gap-2 focus:outline-none group"
                  >
                    <span className="font-mono text-[9px] tracking-wider uppercase text-dim group-hover:text-brand transition-colors">
                      {config.api_enabled ? t("api_enabled_label") : t("api_disabled_label")}
                    </span>
                    {config.api_enabled ? (
                      <ToggleRight size={30} className="text-success cursor-pointer transition-transform duration-200 hover:scale-105" />
                    ) : (
                      <ToggleLeft size={30} className="text-muted cursor-pointer transition-transform duration-200 hover:scale-105" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="label-accent text-[9px] uppercase tracking-wider">{t("api_port")}</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={65535}
                      className="input-field text-xs font-mono rounded-xl border-strong focus:border-accent-brand focus:ring-1 focus:ring-accent-brand transition-all"
                      value={config.api_port}
                      onChange={(e) => setConfig(prev => ({ ...prev, api_port: parseInt(e.target.value) || 8002 }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="label-accent text-[9px] uppercase tracking-wider">{t("api_username")}</label>
                    <input
                      type="text"
                      required
                      className="input-field text-xs font-mono rounded-xl border-strong focus:border-accent-brand focus:ring-1 focus:ring-accent-brand transition-all"
                      value={config.api_username}
                      onChange={(e) => setConfig(prev => ({ ...prev, api_username: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="label-accent text-[9px] uppercase tracking-wider">{t("api_password")}</label>
                    <input
                      type="password"
                      required
                      className="input-field text-xs font-mono rounded-xl border-strong focus:border-accent-brand focus:ring-1 focus:ring-accent-brand transition-all"
                      value={config.api_password}
                      onChange={(e) => setConfig(prev => ({ ...prev, api_password: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg active:scale-95"
                  >
                    {saving && <RefreshCw size={12} className="animate-spin" />}
                    {t("api_save_settings")}
                  </button>
                </div>
              </form>

              {/* API Endpoints & Links Panel */}
              <div className="panel p-6 flex flex-col gap-4 relative overflow-hidden flex-1">
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent-brand" />
                <div className="flex items-center gap-2 pb-2 border-b border-brand">
                  <Globe size={15} className="text-accent-brand" />
                  <span className="heading-stencil text-xs">{t("api_connection_addresses")}</span>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[9px] font-display uppercase tracking-widest text-dim flex items-center gap-1">
                        <Link2 size={10} className="text-accent-brand" />
                        {t("api_local_url")}
                      </div>
                      <div className="flex items-center justify-between bg-bg-deep/45 border border-strong rounded-xl p-3 hover:border-brand/60 transition-colors">
                        <span className="font-mono text-xs text-brand select-all">{localApiUrl}</span>
                        <button
                          onClick={() => copyToClipboard(localApiUrl)}
                          className="text-muted hover:text-brand transition-colors p-1 rounded-md hover:bg-surface/50"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {wanApiUrl && (
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[9px] font-display uppercase tracking-widest text-dim flex items-center gap-1">
                          <Globe size={10} className="text-accent-brand" />
                          {t("api_wan_url")}
                        </div>
                        <div className="flex items-center justify-between bg-bg-deep/45 border border-strong rounded-xl p-3 hover:border-brand/60 transition-colors">
                          <span className="font-mono text-xs text-brand select-all">{wanApiUrl}</span>
                          <button
                            onClick={() => copyToClipboard(wanApiUrl)}
                            className="text-muted hover:text-brand transition-colors p-1 rounded-md hover:bg-surface/50"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex flex-col gap-3">
                    <a
                      href={`${localApiUrl}/docs`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary rounded-xl py-3 px-6 flex items-center justify-center gap-2 text-center text-xs transition-all hover:bg-surface-2 hover:border-accent-brand"
                    >
                      <ExternalLink size={13} />
                      {t("api_swagger_docs")}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live status card, Web App Intro, & Test Console */}
            <div className="flex flex-col gap-6">
              
              {/* Status Card & Web App Intro combined */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Status Card */}
                <div className="panel p-5 relative overflow-hidden flex flex-col gap-2 sm:col-span-1">
                  <span
                    className="absolute left-0 top-0 bottom-0 w-1.5 rounded-r-md transition-all duration-300"
                    style={{
                      background: config.api_enabled ? "var(--success)" : "var(--border-strong)",
                      boxShadow: config.api_enabled ? "0 0 12px var(--success)" : "none",
                    }}
                  />
                  <div className="text-dim text-[8px] font-display tracking-widest uppercase flex items-center gap-1.5">
                    <Shield size={10} className={config.api_enabled ? "text-success" : "text-dim"} />
                    {t("api_server_status")}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1">
                    <span
                      className="w-2 h-2 rounded-full transition-all duration-300"
                      style={{
                        background: config.api_enabled ? "var(--success)" : "var(--border-strong)",
                        boxShadow: config.api_enabled ? "0 0 10px var(--success)" : "none",
                      }}
                    />
                    <span className="heading-stencil text-xs font-bold tracking-wide">
                      {config.api_enabled ? t("api_active") : t("api_inactive")}
                    </span>
                  </div>
                  <div className="text-dim text-[10px] leading-relaxed mt-2 border-t border-brand/20 pt-2">
                    {config.api_enabled ? t("api_status_active_desc", { port: config.api_port }) : t("api_status_inactive_desc")}
                  </div>
                </div>

                {/* Web App Intro Card */}
                <div className="panel p-5 relative overflow-hidden flex flex-col gap-1 sm:col-span-2">
                  <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-success to-accent-brand" />
                  <div className="text-dim text-[8px] font-display tracking-widest uppercase flex items-center gap-1.5">
                    <Laptop size={11} className="text-accent-brand" />
                    {t("api_remote_control_title")}
                  </div>
                  <div className="text-brand font-semibold text-xs mt-0.5">
                    {t("api_remote_control_sub")}
                  </div>
                  <div className="text-dim text-[10px] leading-snug">
                    {t("api_remote_control_desc", { url: localApiUrl })}
                  </div>
                </div>
              </div>

              {/* API Client Simulator Console */}
              <div className="panel p-5 flex flex-col gap-4 relative overflow-hidden">
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
                <div className="flex items-center gap-2 pb-2 border-b border-brand">
                  <Terminal size={14} className="text-accent-brand" />
                  <span className="heading-stencil text-xs">{t("api_test_console")}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!config.api_enabled || consoleLoading}
                    onClick={testGetToken}
                    className="btn-secondary rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-xs transition-all hover:bg-surface-2 disabled:opacity-40"
                  >
                    <Key size={12} />
                    {t("api_test_token_btn")}
                  </button>

                  <button
                    type="button"
                    disabled={!testToken || consoleLoading}
                    onClick={testGetServers}
                    className="btn-secondary rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-xs transition-all hover:bg-surface-2 disabled:opacity-40"
                  >
                    <Activity size={12} />
                    {t("api_test_servers_btn")}
                  </button>
                </div>

                {/* Token Display */}
                {testToken && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-dim flex items-center gap-1">
                      <Info size={10} className="text-success" />
                      {t("api_token_label")}
                    </div>
                    <div className="flex items-center justify-between bg-bg-deep/60 border border-strong rounded-xl p-2.5 font-mono text-[9px] text-success overflow-hidden hover:border-brand/40 transition-colors">
                      <span className="truncate mr-2 select-all">{testToken}</span>
                      <button
                        onClick={() => copyToClipboard(testToken)}
                        className="text-muted hover:text-brand shrink-0 p-1 hover:bg-surface/50 rounded-md"
                      >
                        {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Console Log Display */}
                <div className="bg-bg-deep/80 border border-strong rounded-xl p-3.5 font-mono text-[10px] overflow-y-auto h-[170px] flex flex-col gap-2.5 scrollbar-thin">
                  {consoleLogs.length === 0 ? (
                    <div className="text-dim text-center py-10 flex flex-col items-center justify-center gap-2">
                      <Terminal size={18} className="text-dim/40" />
                      <span>{t("api_test_no_req")}</span>
                    </div>
                  ) : (
                    consoleLogs.map((log, idx) => (
                      <div key={idx} className="border-b border-slate-900 pb-2 last:border-0 last:pb-0 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-dim text-[8px]">
                          <span>{log.time}</span>
                          <span
                            className="uppercase tracking-wider font-bold"
                            style={{
                              color:
                                log.type === "request"
                                  ? "var(--info)"
                                  : log.type === "success"
                                  ? "var(--success)"
                                  : "var(--danger)",
                            }}
                          >
                            {log.type}
                          </span>
                        </div>
                        <div className="text-brand whitespace-pre-wrap font-mono text-[9px] leading-normal">{log.message}</div>
                        {log.data && (
                          <pre className="bg-bg-deep/90 text-success p-2.5 rounded-lg mt-1 overflow-x-auto text-[9px] leading-relaxed scrollbar-none border border-strong/50">
                            {log.data}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
