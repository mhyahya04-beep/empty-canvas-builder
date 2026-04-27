import { useMemo } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Settings, BookOpen } from "lucide-react";
import { useItemsStore } from "@/stores/items-store";
import { itemIsArchived } from "@/models/item";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const items = useItemsStore((s) => s.items);

  const subjectsWithCounts = useMemo(() => {
    const childCounts = new Map<string, number>();

    for (const item of items) {
      if (item.subjectId && !itemIsArchived(item)) {
        childCounts.set(item.subjectId, (childCounts.get(item.subjectId) ?? 0) + 1);
      }
    }

    const subs = items
      .filter((i) => i.type === "subject" && !itemIsArchived(i))
      .sort((a, b) => a.title.localeCompare(b.title));

    return subs.map((s) => ({
      ...s,
      childCount: childCounts.get(s.id) ?? 0,
    }));
  }, [items]);

  const loc = useLocation();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar/50 text-sidebar-foreground backdrop-blur-sm">
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="font-serif text-xl font-bold tracking-tight text-foreground">Scholar</div>
      </div>

      <nav className="space-y-1 px-4">
        <NavItem
          to="/"
          icon={<Home className="h-4 w-4" />}
          label="Dashboard"
          active={loc.pathname === "/"}
          onNavigate={onNavigate}
        />
        <NavItem
          to="/search"
          icon={<Search className="h-4 w-4" />}
          label="Search"
          active={loc.pathname === "/search"}
          onNavigate={onNavigate}
        />
        <NavItem
          to="/settings"
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          active={loc.pathname === "/settings"}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="mt-10 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
        Subjects
      </div>
      <div className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-4 pb-6">
        {subjectsWithCounts.map((s) => {
          const active = loc.pathname === `/subjects/${s.id}`;
          return (
            <Link
              key={s.id}
              to="/subjects/$subjectId"
              params={{ subjectId: s.id }}
              onClick={onNavigate}
              className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                active
                  ? "bg-primary/10 font-medium text-primary shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-foreground"
              }`}
            >
              <span className="truncate">{s.title}</span>
              <span
                className={`text-[10px] font-bold ${active ? "text-primary/70" : "text-muted-foreground/50 group-hover:text-muted-foreground/80"}`}
              >
                {s.childCount}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function NavItem({
  to,
  icon,
  label,
  active,
  onNavigate,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
        active
          ? "bg-primary/10 font-bold text-primary shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-foreground"
      }`}
    >
      <span
        className={`${active ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary/70"}`}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
