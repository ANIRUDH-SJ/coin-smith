import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBuild } from '../src/builder.js';
import { initEcc } from '../src/compat.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });
    return;
  }
  try {
    initEcc(); // idempotent secp256k1 / bitcoinjs-lib init
    const report = handleBuild(req.body);
    res.status(report.ok ? 200 : 400).json(report);
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: e?.message || String(e) },
    });
  }
}
