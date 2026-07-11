/**
 * ConnectRemoteModal — v1.0.45.
 *
 * Popup wizard for adding a hosted SCUM server (G-Portal, PingPerfect, or
 * any FTP/FTPS/SFTP-accessible host). Two stages:
 *   1) Credential entry + Test Connection — admin iterates the remote path
 *      until the backend reports `looks_scumish: true`.
 *   2) Confirmation → POST /api/remote-servers + close.
 *
 * No persistence happens until the admin clicks SAVE on stage 2 — the Test
 * button is a pure read-only probe.
 */
import React, { useState } from "react";
import { X, Globe, Lock, Server as ServerIcon, RefreshCw, Check, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../providers/I18nProvider";
import { endpoints } from "../lib/api";

const PROTOCOLS = [
  { id: "ftp",  label: "FTP",  default_port: 21 },
  { id: "ftps", label: "FTPS", default_port: 21 },
  { id: "sftp", label: "SFTP", default_port: 22 },
];

export const ConnectRemoteModal = ({ onClose, onCreated }) => {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "",
    provider_hint: "",
    protocol: "ftp",
    host: "",
    port: "",
    username: "",
    password: "",
    // v1.0.46 — `remote_path` field removed from the UI per user request:
    // FTP/SFTP clients already see the directory tree on connect, so we just
    // default to "/". The browser/settings editor (Phase 2) will let the
    // admin pick the SCUM folder by clicking it in the live listing.
  });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const portEffective = form.port || (PROTOCOLS.find((p) => p.id === form.protocol)?.default_port ?? 21);

  const handleTest = async () => {
    if (!form.host || !form.username) {
      toast.error(t("remote_validation_missing"));
      return;
    }
    setTesting(true);
    setProbe(null);
    try {
      const r = await endpoints.testRemoteConnection({
        protocol: form.protocol,
        host: form.host.trim(),
        port: parseInt(portEffective, 10) || undefined,
        username: form.username.trim(),
        password: form.password,
        remote_path: "/",
      });
      setProbe(r);
      if (r.ok) {
        toast.success(t("remote_test_ok"));
      } else {
        toast.error(`${t("remote_test_failed")}: ${r.error || "?"}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      toast.error(t("remote_validation_missing"));
      return;
    }
    setBusy(true);
    try {
      const created = await endpoints.createRemoteServer({
        name: form.name.trim(),
        provider_hint: form.provider_hint.trim() || null,
        protocol: form.protocol,
        host: form.host.trim(),
        port: parseInt(portEffective, 10) || undefined,
        username: form.username.trim(),
        password: form.password,
        remote_path: "/",
      });
      toast.success(t("remote_saved"));
      onCreated?.(created);
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const canSave = form.name.trim() && form.host.trim() && form.username.trim() && form.password;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="connect-remote-modal"
    >
      <div
        className="w-full max-w-2xl bg-surface-2 border border-brand shadow-2xl"
        style={{ borderRadius: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-brand flex items-center justify-between"
             style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent)" }}>
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-accent-brand" />
            <div>
              <div className="heading-stencil text-base">{t("remote_modal_title")}</div>
              <div className="text-[10px] uppercase tracking-widest text-dim">
                G-Portal · PingPerfect · {t("remote_any_ftp")}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn" data-testid="connect-remote-close"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Identity row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-accent block mb-1">{t("remote_name_label")}</label>
              <input
                className="input-field"
                placeholder="My G-Portal server"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                data-testid="remote-input-name"
              />
            </div>
            <div>
              <label className="label-accent block mb-1">{t("remote_provider_label")}</label>
              <input
                className="input-field"
                placeholder="G-Portal · PingPerfect · …"
                value={form.provider_hint}
                onChange={(e) => setField("provider_hint", e.target.value)}
                data-testid="remote-input-provider"
              />
            </div>
          </div>

          {/* Protocol pills */}
          <div>
            <label className="label-accent block mb-2">{t("remote_protocol_label")}</label>
            <div className="flex gap-2">
              {PROTOCOLS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setField("protocol", p.id); setField("port", ""); }}
                  className={`px-4 py-2 border font-mono text-[11px] tracking-widest uppercase transition-all ${
                    form.protocol === p.id
                      ? "border-accent-brand bg-accent-brand/15 text-accent-brand"
                      : "border-brand bg-bg-deep/40 text-dim hover:text-brand"
                  }`}
                  style={{ borderRadius: 999 }}
                  data-testid={`remote-protocol-${p.id}`}
                >
                  {p.label} · {p.default_port}
                </button>
              ))}
            </div>
          </div>

          {/* Host + port */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="label-accent block mb-1">{t("remote_host_label")}</label>
              <input
                className="input-field"
                placeholder="123.45.67.89  ·  ftp.g-portal.com"
                value={form.host}
                onChange={(e) => setField("host", e.target.value)}
                data-testid="remote-input-host"
              />
            </div>
            <div>
              <label className="label-accent block mb-1">{t("remote_port_label")}</label>
              <input
                className="input-field font-mono"
                placeholder={String(portEffective)}
                value={form.port}
                onChange={(e) => setField("port", e.target.value.replace(/\D/g, ""))}
                data-testid="remote-input-port"
              />
            </div>
          </div>

          {/* Username + password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-accent block mb-1">{t("remote_user_label")}</label>
              <input
                className="input-field"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                data-testid="remote-input-username"
              />
            </div>
            <div>
              <label className="label-accent block mb-1">
                <Lock size={11} className="inline mr-1 text-accent-brand" />
                {t("remote_pass_label")}
              </label>
              <input
                className="input-field font-mono"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                data-testid="remote-input-password"
              />
            </div>
          </div>

          {/* v1.0.46 — Remote path input removed. The FTP/SFTP client shows
              the directory tree once connected; admins pick the SCUM folder
              in the Settings/Browser tab (Phase 2). */}

          {/* Test result panel */}
          {probe && (
            <div
              className={`border px-4 py-3 ${probe.ok ? "border-[var(--success)]" : "border-danger"}`}
              style={{
                borderRadius: 12,
                background: probe.ok
                  ? "color-mix(in srgb, var(--success) 8%, transparent)"
                  : "color-mix(in srgb, var(--danger) 10%, transparent)",
              }}
              data-testid="remote-probe-result"
            >
              <div className="flex items-center gap-2 mb-2">
                {probe.ok
                  ? <Check size={15} className="text-[var(--success)]" />
                  : <AlertCircle size={15} className="text-[var(--danger)]" />}
                <span className="font-mono text-xs uppercase tracking-widest"
                      style={{ color: probe.ok ? "var(--success)" : "var(--danger)" }}>
                  {probe.ok ? t("remote_test_ok") : t("remote_test_failed")}
                </span>
                {probe.ok && (
                  <span className="ml-auto text-[10px] text-dim font-mono">
                    {probe.entry_count} {t("remote_entries")} · {probe.looks_scumish ? t("remote_scumish_yes") : t("remote_scumish_no")}
                  </span>
                )}
              </div>
              {probe.ok && probe.listing_sample?.length > 0 && (
                <ul className="text-[11px] font-mono text-brand">
                  {probe.listing_sample.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 py-0.5">
                      <span className="text-dim">{e.is_dir ? "📁" : "📄"}</span>
                      <span className="truncate">{e.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!probe.ok && (
                <p className="text-[11px] font-mono text-danger break-all">{probe.error}</p>
              )}
              {probe.ok && !probe.looks_scumish && (
                <p className="text-[11px] text-warning mt-2">{t("remote_scumish_warning")}</p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-brand flex items-center gap-3 bg-bg-deep/30">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !form.host || !form.username}
            className="btn-secondary inline-flex items-center gap-2"
            data-testid="remote-test-btn"
          >
            <RefreshCw size={12} className={testing ? "animate-spin" : ""} />
            {t("remote_test_btn")}
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost" data-testid="remote-cancel-btn">
            {t("cancel") || "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !canSave}
            className="btn-primary inline-flex items-center gap-2"
            data-testid="remote-save-btn"
          >
            <ServerIcon size={12} />
            {t("remote_save_btn")} <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
