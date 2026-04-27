
import { db } from "@/lib/db/db";
import { getDocument, listAttachments, getAttachmentDataUrl } from "@/lib/storage";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import type { SyncProvider, SyncState, SyncStatus } from "./types";
import { DriveAdapter } from "./google-drive-adapter";

export class GoogleDriveProvider implements SyncProvider {
  private adapter: DriveAdapter;
  private state: SyncState = { status: 'idle' };

  constructor() {
    this.adapter = new DriveAdapter();
  }

  authorize(token: string): void {
    this.adapter.setToken(token);
  }

  getState(): SyncState {
    return this.state;
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    // In a real app, we'd trigger a callback or use an observable here
    console.log(`Sync State Changed: ${this.state.status}`);
  }

  /**
   * Pushes all local data to Drive
   */
  async pushToDrive(): Promise<void> {
    try {
      this.setState({ status: 'syncing', error: undefined });
      
      await this.adapter.ensureStructure();

      // 1. Sync app-data.json
      const appData = await this.getSerializedAppData();
      await this.adapter.uploadFile('app-data.json', appData, 'application/json');

      // 2. Sync Readable Archive (DOCX)
      const records = await db.records.toArray();
      const workspaces = await db.workspaces.toArray();
      const fields = await db.fields.toArray();

      for (const record of records) {
        const workspace = workspaces.find(w => w.id === record.workspaceId);
        const table = await db.tablesStore.get(record.tableId);
        const recordFields = fields.filter(f => f.tableId === record.tableId);

        if (workspace && table) {
          const docxBlob = await this.generateRecordDocx(record, recordFields);
          const path = `readable-archive/${workspace.name}/${table.name}/${record.title || 'Untitled'}.docx`;
          await this.adapter.uploadFile(path, docxBlob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }
      }

      // 3. Sync Attachments
      for (const record of records) {
        const attachments = await db.attachments.where({ ownerId: record.id }).toArray();
        for (const att of attachments) {
          // Assuming att.dataUrl is the base64 content
          const path = `attachments/${record.id}/${att.name}`;
          await this.adapter.uploadFile(path, att.dataUrl, att.mimeType);
        }
      }

      this.setState({ status: 'idle', lastSyncAt: new Date().toISOString() });
    } catch (error: any) {
      this.setState({ status: 'error', error: error.message });
      throw error;
    }
  }

  /**
   * Pulls data from Drive (Simplified logic)
   */
  async pullFromDrive(): Promise<void> {
    try {
      this.setState({ status: 'syncing', error: undefined });
      
      const appDataJson = await this.adapter.downloadFile('app-data.json') as string;
      const appData = JSON.parse(appDataJson);
      
      // Merge logic would go here (Dexie bulkPut, etc.)
      console.log("Pulled app data from Drive:", appData);

      this.setState({ status: 'idle', lastSyncAt: new Date().toISOString() });
    } catch (error: any) {
      this.setState({ status: 'error', error: error.message });
      throw error;
    }
  }

  /**
   * Detects changes by comparing timestamps
   */
  async detectChanges(): Promise<boolean> {
    const remoteMeta = await this.adapter.getMetadata('app-data.json');
    if (!remoteMeta) return true;

    const lastSync = this.state.lastSyncAt ? new Date(this.state.lastSyncAt) : new Date(0);
    const remoteDate = new Date(remoteMeta.modifiedTime);

    return remoteDate > lastSync;
  }

  /**
   * Helper to serialize all relevant local data
   */
  private async getSerializedAppData(): Promise<string> {
    const data = {
      workspaces: await db.workspaces.toArray(),
      tables: await db.tablesStore.toArray(),
      fields: await db.fields.toArray(),
      records: await db.records.toArray(),
      syncedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generates a DOCX file for a record using the required structure:
   * --- METADATA ---
   * --- NOTES ---
   */
  private async generateRecordDocx(record: any, fields: any[]): Promise<Blob> {
    const sections: any[] = [
      new Paragraph({
        text: record.title || "Untitled",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "--- METADATA ---", bold: true, color: "666666" }),
        ],
        spacing: { before: 400, after: 200 },
      }),
    ];

    // Add metadata table
    const tableRows = fields.map(f => {
      const val = record.fields?.[f.id] || "";
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f.name, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: String(val) })] }),
        ],
      });
    });

    if (tableRows.length > 0) {
      sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }));
    }

    sections.push(new Paragraph({
      children: [
        new TextRun({ text: "--- NOTES ---", bold: true, color: "666666" }),
      ],
      spacing: { before: 400, after: 200 },
    }));

    // Extract text from document content (assumed JSON from Tiptap)
    const notes = this.extractTextFromTiptap(record.documentContent);
    notes.forEach(text => {
      sections.push(new Paragraph({ text, spacing: { after: 120 } }));
    });

    const doc = new Document({
      sections: [{ children: sections }],
    });

    return await Packer.toBlob(doc);
  }

  private extractTextFromTiptap(content: any): string[] {
    if (!content || !content.content) return ["(No notes)"];
    const lines: string[] = [];
    
    const traverse = (node: any) => {
      if (node.type === 'text') return node.text;
      if (node.type === 'paragraph') {
        let line = "";
        if (node.content) {
          node.content.forEach((child: any) => {
            line += traverse(child) || "";
          });
        }
        lines.push(line);
        return "";
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
      return "";
    };

    content.content.forEach(traverse);
    return lines.filter(l => l.trim().length > 0);
  }
}
