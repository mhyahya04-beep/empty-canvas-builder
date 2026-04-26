import { createFileRoute } from '@tanstack/react-router';
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/db/db';
import { ensureSeed, createRecord, getWorkspaces, getDefaultTableForWorkspace, getFieldsForTable, getRecordsForTable, deleteRecord, duplicateRecord, getViewsForTable, createView } from '@/lib/storage';
import { exportTableCSV, exportWorkspaceArchive, exportFullBackupJSON, exportUrgentCSV } from '@/lib/exporters';
import { AppShell } from '@/components/app-shell';
import { useToast } from '@/components/ui/toast';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CellEditor } from '@/components/cell-editor';
import { RecordDrawer } from '@/components/record-drawer';

function Toolbar({ onAdd, onSearch, search, views, onSelectView, viewType, setViewType, groupFieldId, setGroupFieldId, fields, onSaveView, onExport }: any) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <button onClick={onAdd} className="btn">Add record</button>
      </div>
      <div className="flex items-center gap-2">
        <select value={viewType} onChange={(e) => setViewType(e.target.value)} className="px-2 py-1 rounded border bg-input text-sm">
          <option value="table">Table</option>
          <option value="list">List</option>
          <option value="gallery">Gallery</option>
          <option value="board">Board</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search records" className="px-2 py-1 rounded border bg-input text-sm" />
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <select onChange={(e) => onSelectView(e.target.value)} className="px-2 py-1 rounded border bg-input text-sm">
          <option value="">Default view</option>
          {views.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button onClick={() => { const name = window.prompt('Save view as:'); if (name && onSaveView) onSaveView(name); }} className="px-2 py-1 rounded border bg-input text-sm">Save view</button>
        <button onClick={() => { const c = window.prompt('Export: table / workspace / backup / urgent (enter one)'); if (c && onExport) onExport(c); }} className="px-2 py-1 rounded border bg-input text-sm">Export</button>
      </div>
      {viewType === 'board' && (
        <div className="flex items-center gap-2">
          <select value={groupFieldId || ''} onChange={(e) => setGroupFieldId(e.target.value)} className="px-2 py-1 rounded border bg-input text-sm">
            <option value="">Group by</option>
            {fields.filter((f: any) => f.type === 'select').map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/records')({
  component: () => {
    const { toast } = useToast();
    const [fields, setFields] = useState<any[]>([]);
    const [records, setRecords] = useState<any[]>([]);
    const [views, setViews] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [viewType, setViewType] = useState<'table'|'list'|'gallery'|'board'>('table');
    const [groupFieldId, setGroupFieldId] = useState<string | null>(null);
    const [currentTable, setCurrentTable] = useState<any | null>(null);

    useEffect(() => {
      let mounted = true;
      (async () => {
        await ensureSeed();
        const workspaces = await getWorkspaces();
        if (!mounted) return;
        if (workspaces.length === 0) return;
        const workspace = workspaces[0];
        const table = await getDefaultTableForWorkspace(workspace.id);
        if (!table) return;
        const f = await getFieldsForTable(table.id);
        const r = await getRecordsForTable(table.id);
        const vs = await getViewsForTable(table.id);
        if (!mounted) return;
        setCurrentTable(table);
        setFields(f);
        setRecords(r);
        setViews(vs);
      })();
      const iv = setInterval(async () => {
        const workspaces = await getWorkspaces();
        if (workspaces.length === 0) return;
        const workspace = workspaces[0];
        const table = await getDefaultTableForWorkspace(workspace.id);
        if (!table) return;
        setCurrentTable(table);
        setFields(await getFieldsForTable(table.id));
        setRecords(await getRecordsForTable(table.id));
        setViews(await getViewsForTable(table.id));
      }, 800);
      return () => { mounted = false; clearInterval(iv); };
    }, []);

    const [openRecordId, setOpenRecordId] = useState<string | null>(null);

    const filtered = useMemo(() => {
      const q = (search || "").toLowerCase().trim();
      let arr = records.slice();
      if (q) {
        arr = arr.filter((r) => {
          if ((r.title || "").toLowerCase().includes(q)) return true;
          const vals = Object.values(r.values || {}).map(String).join(" ").toLowerCase();
          if (vals.includes(q)) return true;
          return false;
        });
      }
      return arr;
    }, [records, search]);

    return (
      <AppShell>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Records</h1>
          <Toolbar onAdd={async () => { const workspaces = await getWorkspaces(); if (!workspaces[0]) return; const table = await getDefaultTableForWorkspace(workspaces[0].id); if (!table) return; await createRecord(table.id); }} onSearch={setSearch} search={search} views={views} onSelectView={async (id: string) => { if (!id) return; const v = views.find((x) => x.id === id); if (v && v.visibleFieldIds) setFields(fields.filter((f) => v.visibleFieldIds.includes(f.id))); }} viewType={viewType} setViewType={setViewType} groupFieldId={groupFieldId} setGroupFieldId={setGroupFieldId} fields={fields} onSaveView={async (name: string) => { if (!currentTable) return; const v = await createView({ tableId: currentTable.id, workspaceId: currentTable.workspaceId, name, type: viewType, visibleFieldIds: fields.map((f:any) => f.id) }); setViews([...views, v]); }} onExport={async (choice: string) => {
            if (!currentTable) { toast({ title: 'No table selected' }); return; }
            try {
              if (choice === 'table') { await exportTableCSV(currentTable.id); toast({ title: 'Table exported (CSV)' }); }
              else if (choice === 'workspace') { await exportWorkspaceArchive(currentTable.workspaceId); toast({ title: 'Workspace archive ready' }); }
              else if (choice === 'backup') { await exportFullBackupJSON(); toast({ title: 'Full backup exported' }); }
              else if (choice === 'urgent') { await exportUrgentCSV(); toast({ title: 'Urgent items exported (CSV)' }); }
              else toast({ title: 'Unknown export: ' + choice });
            } catch (e: any) { console.error(e); toast({ title: 'Export failed: ' + (e?.message ?? String(e)) }); }
          }} />

          {viewType === 'table' && (
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Title</TableHead>
                  {fields.map((f) => <TableHead key={f.id}>{f.name}</TableHead>)}
                  <TableHead></TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filtered.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="max-w-xs truncate">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setOpenRecordId(rec.id)} className="hover:underline text-left w-full">{rec.title}</button>
                        <div className="flex gap-1 ml-2">
                          <button onClick={async () => { await duplicateRecord(rec.id); }} className="text-xs px-2 py-1 rounded hover:bg-muted">Duplicate</button>
                          <button onClick={async () => { await deleteRecord(rec.id); }} className="text-xs px-2 py-1 rounded text-destructive hover:bg-muted">Delete</button>
                        </div>
                      </div>
                    </TableCell>
                    {fields.map((f) => (
                      <TableCell key={f.id}>
                        <CellEditor field={f} record={rec} />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {viewType === 'list' && (
            <div className="space-y-2">
              {filtered.map((rec) => (
                <div key={rec.id} className="p-3 border border-border rounded flex items-center justify-between">
                  <div>
                    <button onClick={() => setOpenRecordId(rec.id)} className="font-medium hover:underline">{rec.title}</button>
                    <div className="text-xs text-muted-foreground">{Object.values(rec.values || {}).slice(0,3).map(String).join(' • ')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => { await duplicateRecord(rec.id); }} className="text-xs px-2 py-1 rounded hover:bg-muted">Duplicate</button>
                    <button onClick={async () => { await deleteRecord(rec.id); }} className="text-xs px-2 py-1 rounded text-destructive hover:bg-muted">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewType === 'gallery' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((rec) => (
                <div key={rec.id} className="p-4 border border-border rounded bg-card">
                  <button onClick={() => setOpenRecordId(rec.id)} className="font-semibold hover:underline text-left block mb-2">{rec.title}</button>
                  <div className="text-xs text-muted-foreground">{Object.values(rec.values || {}).slice(0,4).map(String).join(' • ')}</div>
                </div>
              ))}
            </div>
          )}

          {viewType === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                if (!groupFieldId) return <div className="text-xs text-muted-foreground">Select a group field to view board</div>;
                const field = fields.find((f) => f.id === groupFieldId);
                if (!field) return <div className="text-xs text-muted-foreground">Invalid group field</div>;
                const groups: Record<string, any[]> = {};
                // group by select option id
                for (const rec of filtered) {
                  const v = rec.values?.[groupFieldId] ?? '__none__';
                  if (!groups[v]) groups[v] = [];
                  groups[v].push(rec);
                }
                const keys = Object.keys(groups);
                return keys.map((k) => (
                  <div key={k} className="p-3 border border-border rounded bg-card">
                    <div className="font-medium mb-2">{k === '__none__' ? 'No value' : (field.options?.find((o: any) => o.id === k)?.label ?? k)}</div>
                    <div className="space-y-2">
                      {groups[k].map((rec) => (
                        <div key={rec.id} className="p-2 border border-border rounded bg-white">
                          <button onClick={() => setOpenRecordId(rec.id)} className="font-medium hover:underline text-left block">{rec.title}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
        <RecordDrawer recordId={openRecordId} onClose={() => setOpenRecordId(null)} />
      </AppShell>
    );
  },
});
