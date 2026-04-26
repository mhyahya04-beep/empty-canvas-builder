import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import React from 'react';
import { DocumentEditor } from '@/components/document-editor';

export const Route = createFileRoute('/items/$itemId')({
  component: ({ params }: any) => {
    const { itemId } = params as { itemId: string };
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto">
          <DocumentEditor recordId={itemId} />
        </div>
      </AppShell>
    );
  },
});
