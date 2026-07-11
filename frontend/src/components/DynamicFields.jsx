import React, { useMemo, useState } from "react";
import { Field } from "./Field";
import { humanizeKey, detectFieldType } from "../lib/settingsSchema";
import { getFieldMeta } from "../lib/fieldMeta";
import { useI18n } from "../providers/I18nProvider";

/**
 * Renders a dict of key->value as a grid of Field components.
 * Uses FIELD_META for translated labels + descriptions, falls back to humanizeKey.
 * Accepts a `fieldKeys` filter to render only specific keys.
 */
export const DynamicFields = ({ values = {}, fieldKeys, excludeFieldKeys, onFieldChange, testIdPrefix }) => {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const all = Object.entries(values);
    if (fieldKeys && fieldKeys.length > 0) {
      const order = new Map(fieldKeys.map((k, i) => [k, i]));
      return all
        .filter(([k]) => order.has(k))
        .sort((a, b) => order.get(a[0]) - order.get(b[0]));
    }
    // v1.0.36: excludeFieldKeys prunes keys that belong to another category
    // (e.g. Vehicle Stock Caps tab excludes the Fuel/Battery physics fields
    // since those live under Advanced → Vehicle Physics & Fuel — same INI
    // source but rendered in a different place to avoid the duplicate hit
    // admins reported).
    if (excludeFieldKeys && excludeFieldKeys.length > 0) {
      const blocked = new Set(excludeFieldKeys);
      return all.filter(([k]) => !blocked.has(k));
    }
    return all;
  }, [values, fieldKeys, excludeFieldKeys]);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(([k]) => {
      const customLabel = t(`field.${k}.label`);
      const hasCustomLabel = customLabel !== `field.${k}.label`;
      const meta = getFieldMeta(k, lang);
      const label = hasCustomLabel ? customLabel : (meta?.label || humanizeKey(k));
      return k.toLowerCase().includes(q) || label.toLowerCase().includes(q);
    });
  }, [entries, query, lang, t]);

  return (
    <div>
      {entries.length > 8 && (
        <div className="mb-4">
          <input
            className="input-field"
            placeholder={`${t("search")}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid={`${testIdPrefix}-search`}
          />
          <div className="label-overline mt-1">{t("showing")} {filtered.length} {t("of")} {entries.length}</div>
        </div>
      )}
      {/* 2-column layout by default; bump to 3 on wide screens for dense
          categories like Gameplay/World that have 30+ fields, so the user
          doesn't have to scroll for ages. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-1">
        {filtered.map(([k, v]) => {
          const customLabel = t(`field.${k}.label`);
          const customDesc = t(`field.${k}.desc`);
          const hasCustomLabel = customLabel !== `field.${k}.label`;
          const hasCustomDesc = customDesc !== `field.${k}.desc`;

          const meta = getFieldMeta(k, lang);
          const typeMeta = detectFieldType(v, k);
          const field = {
            key: k,
            label: hasCustomLabel ? customLabel : (meta?.label || humanizeKey(k)),
            desc: hasCustomDesc ? customDesc : meta?.desc,
            ...typeMeta,
          };
          return (
            <Field
              key={k}
              field={field}
              value={v}
              onChange={(nv) => onFieldChange(k, nv)}
              testId={`${testIdPrefix}-${k}`}
            />
          );
        })}
      </div>
    </div>
  );
};
