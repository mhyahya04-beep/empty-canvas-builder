export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatRelative(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

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
