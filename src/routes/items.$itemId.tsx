import { Route as RootRoute } from '@/routes/__root';
import { AppShell } from '@/components/app-shell';
import React from 'react';
import { DocumentEditor } from '@/components/document-editor';

export const Route = new RootRoute({
  id: '/items/$itemId',
  path: '/items/:itemId',
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
