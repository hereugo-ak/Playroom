// Shared server helpers for Vercel functions. Never imported by browser code.
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

let transport = null;
let admin = null;

export function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req, limit = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getAdmin() {
  if (!admin) {
    admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export function getTransport() {
  if (!transport) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: requireEnv('SMTP_USER'),
        pass: requireEnv('SMTP_PASS'),
      },
      pool: true,
      maxConnections: 2,
      maxMessages: 20,
    });
  }
  return transport;
}

export function bearer(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

export async function authenticate(req) {
  const token = bearer(req);
  if (!token) return null;
  const admin = getAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function isAdmin(adminClient, userId) {
  if (!userId) return false;
  const { data, error } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) {
    console.warn('[admin] role lookup failed', error?.message || error);
    return false;
  }
  return Boolean(data);
}

export function cleanText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}
