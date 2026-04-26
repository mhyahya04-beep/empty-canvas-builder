import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const {
  AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET,
  AUTH_SECRET,
  AUTH_URL = 'http://localhost:3000',
  PORT = 3000,
} = process.env;

if (!AUTH_GOOGLE_ID || !AUTH_GOOGLE_SECRET || !AUTH_SECRET) {
  console.error('Missing one of AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET in env');
}

const COOKIE_NAME = 'app_session';

const app = express();
app.use(cookieParser());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(cors({ origin: AUTH_URL, credentials: true }));

function createOAuthClient() {
  return new google.auth.OAuth2(
    AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET,
    `${AUTH_URL}/api/auth/callback/google`
  );
}

app.get('/api/auth/login', (req, res) => {
  const o = createOAuthClient();
  const url = o.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
    response_type: 'code',
  });
  return res.redirect(url);
});

app.get('/api/auth/callback/google', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  const o = createOAuthClient();
  try {
    const { tokens } = await o.getToken(code);
    o.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: o });
    const info = await oauth2.userinfo.get();

    const session = {
      sub: info.data.id,
      email: info.data.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpires: tokens.expiry_date,
    };

    const signed = jwt.sign(session, AUTH_SECRET);
    res.cookie(COOKIE_NAME, signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    return res.redirect(`${AUTH_URL}/?auth=success`);
  } catch (err) {
    console.error('auth callback error', err);
    return res.redirect(`${AUTH_URL}/?auth=error`);
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true });
});

function getSession(req) {
  const t = req.cookies[COOKIE_NAME];
  if (!t) return null;
  try {
    return jwt.verify(t, AUTH_SECRET);
  } catch (e) {
    return null;
  }
}

async function ensureDriveClient(req, res) {
  const session = getSession(req);
  if (!session) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }

  const o = createOAuthClient();
  o.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.accessTokenExpires,
  });

  // Refresh if expired or near expiry
  if (!session.accessToken || Date.now() > (session.accessTokenExpires || 0) - 60_000) {
    if (!session.refreshToken) {
      const err = new Error('Missing refresh token');
      err.status = 401;
      throw err;
    }
    try {
      const resp = await o.refreshToken(session.refreshToken);
      const credentials = resp.credentials || resp;
      session.accessToken = credentials.access_token;
      session.accessTokenExpires = credentials.expiry_date;
      // store updated session cookie
      const signed = jwt.sign(session, AUTH_SECRET);
      res.cookie(COOKIE_NAME, signed, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });
      o.setCredentials({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expiry_date: session.accessTokenExpires,
      });
    } catch (e) {
      const err = new Error('Failed to refresh access token');
      err.status = 401;
      throw err;
    }
  }

  return google.drive({ version: 'v3', auth: o });
}

async function findOrCreateAppFolder(drive) {
  const FOLDER_NAME = 'My App Sync';
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${FOLDER_NAME.replace("'","\\'")}' and trashed = false`;
  const list = await drive.files.list({ q, fields: 'files(id, name)' });
  if (list.data.files && list.data.files.length > 0) return list.data.files[0].id;
  const created = await drive.files.create({ requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
  return created.data.id;
}

async function findSyncFile(drive, folderId) {
  const FILE_NAME = 'sync.json';
  const q = `name = '${FILE_NAME.replace("'","\\'")}' and '${folderId}' in parents and trashed = false`;
  const list = await drive.files.list({ q, fields: 'files(id, name)' });
  if (list.data.files && list.data.files.length > 0) return list.data.files[0];
  return null;
}

app.get('/api/drive/load', async (req, res) => {
  try {
    const drive = await ensureDriveClient(req, res);
    const folderId = await findOrCreateAppFolder(drive);
    const file = await findSyncFile(drive, folderId);
    if (!file) return res.status(404).json({ ok: false, error: 'file_not_found' });
    const resp = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
    let data = '';
    await new Promise((resolve, reject) => {
      resp.data.on('data', (chunk) => (data += chunk));
      resp.data.on('end', resolve);
      resp.data.on('error', reject);
    });
    try {
      const parsed = JSON.parse(data || '{}');
      return res.json({ ok: true, data: parsed, id: file.id });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'invalid_json' });
    }
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

app.post('/api/drive/save', async (req, res) => {
  try {
    const drive = await ensureDriveClient(req, res);
    const folderId = await findOrCreateAppFolder(drive);
    const file = await findSyncFile(drive, folderId);
    const data = req.body || {};
    const media = { mimeType: 'application/json', body: JSON.stringify(data) };
    if (file) {
      await drive.files.update({ fileId: file.id, media });
      return res.json({ ok: true, id: file.id });
    } else {
      const created = await drive.files.create({ requestBody: { name: 'sync.json', parents: [folderId], mimeType: 'application/json' }, media, fields: 'id' });
      return res.json({ ok: true, id: created.data.id });
    }
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/drive/delete', async (req, res) => {
  try {
    const drive = await ensureDriveClient(req, res);
    const folderId = await findOrCreateAppFolder(drive);
    const file = await findSyncFile(drive, folderId);
    if (!file) return res.status(404).json({ ok: false, error: 'file_not_found' });
    await drive.files.delete({ fileId: file.id });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

app.get('/api/auth/status', (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({ authenticated: false });
  return res.json({ authenticated: true, email: session.email });
});

app.listen(PORT, () => {
  console.log(`Auth/Drive server listening on http://localhost:${PORT}`);
});
