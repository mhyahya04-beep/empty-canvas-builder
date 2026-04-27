import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useItemsStore } from "@/stores/items-store";
import { ItemCard } from "@/components/items/ItemCard";
import { itemIsArchived } from "@/models/item";

export const Route = createFileRoute("/subjects/$subjectId")({
  component: () => (
    <AppShell>
      <SubjectPage />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold">Subject not found</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    </AppShell>
  ),
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const items = useItemsStore((s) => s.items);
  const subject = items.find((item) => item.id === subjectId && item.type === "subject");

  if (!subject) throw notFound();

  const children = items.filter((item) => item.subjectId === subjectId && !itemIsArchived(item));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          &larr; Dashboard
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{subject.title}</h1>
        {subject.description && (
          <p className="mt-2 text-sm text-muted-foreground">{subject.description}</p>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {children.length} {children.length === 1 ? "item" : "items"}
        </div>
      </div>

      {children.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No items in this subject yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <ItemCard key={child.id} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}
