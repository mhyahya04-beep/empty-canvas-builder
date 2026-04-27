import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import React from 'react';
import { DocumentEditor } from '@/components/document-editor';

export const Route = createFileRoute('/items/$itemId')({
  component: ItemPage,
});

function ItemPage() {
  const { itemId } = Route.useParams();
  const navigate = useNavigate();
  
  return (
    <AppShell>
      <DocumentEditor 
        recordId={itemId} 
        onClose={() => navigate({ to: '..' } as any)} 
        initialFullscreen={true}
      />
    </AppShell>
  );
}

import { useNavigate } from '@tanstack/react-router';
