import React, { useEffect, useState } from 'react';

export function GDriveSync() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadedData, setLoadedData] = useState<any>(null);

  async function checkStatus() {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const j = await res.json();
      setAuthenticated(!!j.authenticated);
      setEmail(j.email || null);
    } catch (e) {
      setAuthenticated(false);
    }
  }

  useEffect(() => { checkStatus(); }, []);

  function signIn() {
    // Redirect to server login endpoint which redirects to Google
    window.location.href = '/api/auth/login';
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setEmail(null);
    setStatus('signed_out');
  }

  async function saveTestData() {
    setStatus('saving');
    try {
      const payload = { savedAt: new Date().toISOString(), test: true, items: [{ id: 1, title: 'Test' }] };
      const res = await fetch('/api/drive/save', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'save_failed');
      setStatus('saved');
    } catch (e: any) {
      setStatus('error: ' + (e.message || e));
    }
  }

  async function loadData() {
    setStatus('loading');
    try {
      const res = await fetch('/api/drive/load', { credentials: 'include' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'load_failed');
      setLoadedData(j.data);
      setStatus('loaded');
    } catch (e: any) {
      setStatus('error: ' + (e.message || e));
    }
  }

  async function deleteFile() {
    setStatus('deleting');
    try {
      const res = await fetch('/api/drive/delete', { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'delete_failed');
      setLoadedData(null);
      setStatus('deleted');
    } catch (e: any) {
      setStatus('error: ' + (e.message || e));
    }
  }

  return (
    <div className="border p-4 rounded">
      <h3 className="font-bold mb-2">Google Drive Sync (Test)</h3>
      <div className="mb-2">Status: {status || 'idle'}</div>
      <div className="mb-2">Authenticated: {authenticated ? 'yes' : 'no'} {email ? `(${email})` : ''}</div>
      <div className="flex gap-2">
        {!authenticated ? (
          <button className="btn" onClick={signIn}>Sign in with Google</button>
        ) : (
          <button className="btn" onClick={signOut}>Sign out</button>
        )}
        <button className="btn" onClick={saveTestData} disabled={!authenticated}>Save test data</button>
        <button className="btn" onClick={loadData} disabled={!authenticated}>Load data</button>
        <button className="btn" onClick={deleteFile} disabled={!authenticated}>Delete sync file</button>
      </div>
      <div className="mt-3">
        <pre className="bg-gray-100 p-2 rounded text-sm">{loadedData ? JSON.stringify(loadedData, null, 2) : 'No data loaded'}</pre>
      </div>
    </div>
  );
}

export default GDriveSync;
