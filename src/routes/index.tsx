import { Route as RootRoute } from '@/routes/__root';
import { AppShell } from '@/components/app-shell';
import { BlocksList } from '@/components/blocks/BlockRenderer';
import { RichTextEditor } from '@/components/rich-editor';
import { UrgentList } from '@/components/urgent-list';
import GDriveSync from '@/components/gdrive-sync/GDriveSync';
import { useState } from 'react';

export const Route = new RootRoute({
  id: '/',
  component: () => {
    const [doc, setDoc] = useState({ type: 'doc', content: [] } as any);
    return (
      <AppShell>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Unified Study Vault</h1>
          <p className="mb-4">This is a minimal unified scaffold combining components from both projects.</p>
          <div className="mb-6">
            <UrgentList />
          </div>
          <div className="mb-6">
            <RichTextEditor initialJSON={doc} onChange={(j) => setDoc(j)} />
          </div>
          <div className="mb-6">
            <GDriveSync />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-2">Sample blocks</h2>
            <BlocksList blocks={[{ id: 'b1', type: 'heading', level: 2, text: 'Example Heading' }, { id: 'b2', type: 'paragraph', text: 'Example paragraph text.' }]} />
          </div>
        </div>
      </AppShell>
    );
  },
});
