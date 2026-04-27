import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DateValue, Field } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatRelative(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

/* ----------------------- Tag colors ----------------------- */

export const TAG_CLASS: Record<string, string> = {
  rose: "bg-tag-rose/20 text-tag-rose border-tag-rose/40",
  sage: "bg-tag-sage/20 text-tag-sage border-tag-sage/40",
  mocha: "bg-tag-mocha/20 text-tag-mocha border-tag-mocha/40",
  blue: "bg-tag-blue/20 text-tag-blue border-tag-blue/40",
  lavender: "bg-tag-lavender/20 text-tag-lavender border-tag-lavender/40",
  cream: "bg-tag-cream/20 text-tag-cream border-tag-cream/40",
  blush: "bg-tag-blush/20 text-tag-blush border-tag-blush/40",
  gold: "bg-tag-gold/20 text-tag-gold border-tag-gold/40",
  terracotta: "bg-tag-terracotta/20 text-tag-terracotta border-tag-terracotta/40",
  charcoal: "bg-tag-charcoal/20 text-tag-charcoal border-tag-charcoal/40",
};

/* ----------------------- Date helpers ----------------------- */

export function isDateValue(v: unknown): v is DateValue {
  return !!v && typeof v === "object" && "start" in (v as Record<string, unknown>);
}

/** Normalize legacy string dates → DateValue */
export function asDateValue(v: unknown): DateValue | null {
  if (!v) return null;
  if (typeof v === "string") return { start: v };
  if (isDateValue(v)) return v;
  return null;
}

const FORMATTERS: Record<NonNullable<DateValue["format"]>, (d: Date) => string> = {
  FULL: (d) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
  MONTH_DAY_YEAR: (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  DAY_MONTH_YEAR: (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  ISO: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  DMY_SLASH: (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
  MDY_SLASH: (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`,
};
function pad(n: number) { return String(n).padStart(2, "0"); }

export function formatDateValue(v: DateValue | null | undefined): string {
  if (!v?.start) return "";
  const start = new Date(v.start);
  const fmt = FORMATTERS[v.format ?? "MONTH_DAY_YEAR"](start);
  let str = fmt;
  if (v.hasTime) {
    str += " " + start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (v.end) {
    const end = new Date(v.end);
    let endStr = FORMATTERS[v.format ?? "MONTH_DAY_YEAR"](end);
    if (v.hasTime) endStr += " " + end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    str += " → " + endStr;
  }
  if (v.tz && v.tz !== "local") str += ` (${v.tz.split("/").pop()})`;
  return str;
}

/* ----------------------- Urgent helpers ----------------------- */

const URGENT_TAGS = new Set(["urgent", "high priority", "high"]);

/** Returns whether a single field value contributes an "urgent" signal. */
export function fieldValueIsUrgent(field: Field, value: unknown): boolean {
  if (!value) return false;
  if (field.type === "select" || field.type === "status") {
    const opt = field.options?.find((o) => o.id === value);
    return !!opt && URGENT_TAGS.has(opt.label.toLowerCase());
  }
  if (field.type === "multiSelect" && Array.isArray(value)) {
    return value.some((id) => {
      const opt = field.options?.find((o) => o.id === id);
      return !!opt && URGENT_TAGS.has(opt.label.toLowerCase());
    });
  }
  return false;
}

export function isFieldDeadlineSoon(field: Field, value: unknown): boolean {
  if (field.type !== "date" && field.type !== "dateTime") return false;
  const dv = asDateValue(value);
  if (!dv?.start) return false;
  const t = new Date(dv.start).getTime();
  const now = Date.now();
  const days = (t - now) / (1000 * 60 * 60 * 24);
  return days <= 7 && days >= -1;
}

/* ----------------------- ID helpers ----------------------- */

export function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").slice(0, 80);
}

export function isoDay(d?: Date) {
  const x = d ?? new Date();
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
