import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { BlocksList } from '@/components/blocks/BlockRenderer';
import { UrgentList } from '@/components/urgent-list';
import { BookOpen, Sparkles, FolderOpen, Database, FileText, Zap } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight">
                  Unified Study Vault
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your notes, records, and references — in one place.
                </p>
              </div>
            </div>
          </header>

          {/* Hero card */}
          <section
            aria-labelledby="welcome-heading"
            className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2
                  id="welcome-heading"
                  className="text-lg font-semibold mb-1"
                >
                  Welcome back
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Pick up where you left off, or start something new. Use the
                  sidebar to browse records, sync, or settings.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href="/records" className="btn">
                    <FolderOpen className="w-4 h-4" aria-hidden="true" />
                    Open Records
                  </a>
                  <a
                    href="/sync"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors text-sm"
                  >
                    <Zap className="w-4 h-4" aria-hidden="true" />
                    Sync
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Quick stats / shortcuts grid */}
          <section
            aria-label="Quick shortcuts"
            className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <ShortcutCard
              href="/records"
              icon={<Database className="w-4 h-4" />}
              title="Records"
              description="Browse and edit your data tables"
            />
            <ShortcutCard
              href="/settings"
              icon={<FileText className="w-4 h-4" />}
              title="Settings"
              description="Themes, backups, storage"
            />
            <ShortcutCard
              href="/sync"
              icon={<Zap className="w-4 h-4" />}
              title="Sync"
              description="Connect Google Drive"
            />
          </section>

          {/* Urgent items */}
          <section aria-labelledby="urgent-heading" className="mb-8">
            <h2 id="urgent-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Urgent
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <UrgentList />
            </div>
          </section>

          {/* Sample blocks */}
          <section aria-labelledby="sample-heading">
            <h2 id="sample-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Sample content
            </h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <BlocksList
                blocks={[
                  { id: 'b1', type: 'heading', level: 2, text: 'Example Heading' },
                  {
                    id: 'b2',
                    type: 'paragraph',
                    text: 'This is an example paragraph rendered by the BlockRenderer component. Use it as a starting point for richer layouts.',
                  },
                ]}
              />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ShortcutCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </span>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </a>
  );
}
