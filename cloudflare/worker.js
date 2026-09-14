// Worker Cloudflare untuk sinkronisasi OPSIONAL Warung Endog Yati.
// Endpoint ini HANYA menyimpan/mengambil satu blob JSON backup milik toko,
// dikunci oleh "Kode Sinkronisasi" yang dibuat sendiri oleh pemilik warung.
// Tidak pernah menyentuh, meneruskan, atau menyimpan kredensial DANA,
// SUPERBANK, Bank, OrderKuota, atau layanan pihak ketiga apa pun.

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

function json(body, init) {
  return cors(Response.json(body, init));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, app: 'Warung Endog Yati' });
    }

    if (request.method === 'POST' && url.pathname === '/api/backup') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Body harus JSON.' }, { status: 400 });
      }
      const code = (body.code || '').trim();
      const data = body.data;
      if (!code || !data) return json({ error: 'code dan data wajib diisi.' }, { status: 400 });
      if (code.length < 4) return json({ error: 'Kode Sinkronisasi minimal 4 karakter.' }, { status: 400 });

      await env.DB.prepare(
        `INSERT INTO backups (code, data, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
        .bind(code, data, new Date().toISOString())
        .run();

      return json({ ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/api/restore') {
      const code = (url.searchParams.get('code') || '').trim();
      if (!code) return json({ error: 'Parameter code wajib diisi.' }, { status: 400 });

      const row = await env.DB.prepare('SELECT data, updated_at FROM backups WHERE code = ?1')
        .bind(code)
        .first();

      if (!row) return json({ error: 'Belum ada backup untuk kode ini.' }, { status: 404 });
      return json({ ok: true, data: row.data, updatedAt: row.updated_at });
    }

    return json({ error: 'Endpoint tidak ditemukan.' }, { status: 404 });
  },
};
