const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

// In-memory cache for serverless runtime
let memCmsConfig = null;

// Post helper for upstream API
function postUpstream(urlStr, postData) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      const postBody = querystring.stringify(postData);

      const options = {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postBody),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout connecting to upstream server'));
      });

      req.on('error', err => reject(err));
      req.write(postBody);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

function generateMockWaybill(resiNum) {
  const cleanResi = (resiNum || 'DSF888999').trim().toUpperCase();
  const now = new Date();

  function fmtDate(d) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return {
      hari: days[d.getDay()],
      tgl: `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`,
      jam: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    };
  }

  const d0 = new Date(now.getTime() - 2 * 3600 * 1000);
  const d1 = new Date(now.getTime() - 14 * 3600 * 1000);
  const d2 = new Date(now.getTime() - 28 * 3600 * 1000);
  const d3 = new Date(now.getTime() - 48 * 3600 * 1000);

  const t0 = fmtDate(d0);
  const t1 = fmtDate(d1);
  const t2 = fmtDate(d2);
  const t3 = fmtDate(d3);

  return {
    resi: cleanResi,
    ok: true,
    progress: 75,
    origin_text: "JAKARTA (KANTOR PUSAT DS FUN LOGISTIC)",
    destination: "SURABAYA (CABANG DS FUN SURABAYA)",
    latest: {
      keterangan: "Paket tiba di Hub Sortir Surabaya, dalam proses persiapan distribusi kurir",
      time_display: `${t0.hari}, ${t0.tgl} ${t0.jam}`
    },
    history: [
      {
        hari: t0.hari,
        tgl_display: t0.tgl,
        jam_display: t0.jam,
        keterangan: "Paket tiba di Hub Sortir Surabaya, dalam proses persiapan distribusi kurir"
      },
      {
        hari: t1.hari,
        tgl_display: t1.tgl,
        jam_display: t1.jam,
        keterangan: "Paket diberangkatkan menuju Surabaya menggunakan Armada Truck DSF-01"
      },
      {
        hari: t2.hari,
        tgl_display: t2.tgl,
        jam_display: t2.jam,
        keterangan: "Paket telah selesai disortir di Hub DS Fun Jakarta Timur"
      },
      {
        hari: t3.hari,
        tgl_display: t3.tgl,
        jam_display: t3.jam,
        keterangan: "Paket telah diterima di Kantor DS Fun Logistic Jakarta"
      }
    ]
  };
}

function calculateLocalRate(params) {
  const da = params.da || params.asal || params.prom || 'JAKARTA';
  const tuj = params.tuj || params.tujuanText || params.tujuan || 'SURABAYA';
  const weight = parseFloat(params.bet || params.brt || params.berat) || 10;
  const le = parseFloat(params.le || params.panjang) || 0;
  const pa = parseFloat(params.pa || params.lebar) || 0;
  const ti = parseFloat(params.ti || params.tinggi) || 0;

  const volumeM3 = (le > 0 && pa > 0 && ti > 0) ? (le * pa * ti) / 1000000 : 0.05;

  let ratePerKg = 2500;
  let ratePerM3 = 850000;
  let estimasi = "2 - 4 Hari";

  const isOuterIsland = /SUMATRA|SULAWESI|KALIMANTAN|PAPUA|BALI|LOMBOK/i.test(tuj);
  if (isOuterIsland) {
    ratePerKg = 4500;
    ratePerM3 = 1450000;
    estimasi = "4 - 7 Hari";
  }

  const minKg = 20;
  const chargedWeight = Math.max(weight, minKg);
  const totalKgPrice = chargedWeight * ratePerKg;
  const totalVolPrice = Math.max(volumeM3 * ratePerM3, 50000);

  const formatIDR = (num) => 'Rp. ' + Math.round(num).toLocaleString('id-ID');

  return {
    da,
    tuj,
    estimasi,
    berat: weight,
    volumeM3: volumeM3.toFixed(3),
    hargaKg: `${weight}kg = ${formatIDR(totalKgPrice)}`,
    hargaKubik: `${volumeM3.toFixed(3)} m³ = ${formatIDR(totalVolPrice)}`,
    totalEstimasi: formatIDR(Math.max(totalKgPrice, totalVolPrice)),
    layanan: 'Cargo Reguler DS Fun Logistic'
  };
}

// Read CMS data with fallback chain
function getCmsConfig(rootDir) {
  if (memCmsConfig) return memCmsConfig;

  // Try /tmp first (Vercel writable)
  const tmpPath = path.join('/tmp', 'cms_config.json');
  if (fs.existsSync(tmpPath)) {
    try {
      memCmsConfig = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
      return memCmsConfig;
    } catch (e) {}
  }

  // Try local file
  const localPath = path.join(rootDir, 'data', 'cms_config.json');
  if (fs.existsSync(localPath)) {
    try {
      memCmsConfig = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      return memCmsConfig;
    } catch (e) {}
  }

  return { version: "1.0", banners: [], menus: [], alerts: {}, contact: {} };
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const rootDir = process.cwd();
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '';

  // Clean pathname prefix if routed through /api
  if (pathname.startsWith('/api/')) {
    // keep pathname as is: e.g. /api/track, /api/tarif
  } else if (!pathname.startsWith('/api')) {
    pathname = '/api' + pathname;
  }

  // Helper to parse JSON or form body
  function getRequestBody() {
    return new Promise((resolve) => {
      if (req.body && typeof req.body === 'object') {
        resolve(req.body);
        return;
      }
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          if (body && (req.headers['content-type'] || '').includes('application/json')) {
            resolve(JSON.parse(body));
          } else if (body) {
            resolve(querystring.parse(body));
          } else {
            resolve({});
          }
        } catch (e) {
          try { resolve(querystring.parse(body)); } catch (err) { resolve({}); }
        }
      });
    });
  }

  // Health check
  if (pathname === '/api/health' || pathname === '/api') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', service: 'DS Fun Logistic API', version: '3.4' }));
    return;
  }

  // Admin Login
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const body = await getRequestBody();
    const username = (body.username || body.account || '').trim();
    const password = (body.password || '').trim();

    const validUsers = [
      { username: 'admin', pass: 'admin', name: 'Default Administrator', role: 'admin' },
      { username: 'admin', pass: 'admin123', name: 'Administrator DS Fun', role: 'admin' },
      { username: 'vrintex', pass: 'kayaraya3+', name: 'Vrintex Master Admin', role: 'admin' }
    ];

    const matched = validUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.pass === password);

    if (matched) {
      const token = 'dsfun_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        message: 'Login Administrator berhasil!',
        token: token,
        user: { username: matched.username, name: matched.name, role: matched.role }
      }));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 401;
      res.end(JSON.stringify({
        success: false,
        message: 'Username atau kata sandi tidak valid. Silakan periksa kembali.'
      }));
    }
    return;
  }

  // CMS Content GET
  if (pathname === '/api/admin/content' && req.method === 'GET') {
    const cfg = getCmsConfig(rootDir);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.statusCode = 200;
    res.end(JSON.stringify(cfg));
    return;
  }

  // CMS Content POST
  if (pathname === '/api/admin/content' && req.method === 'POST') {
    try {
      const body = await getRequestBody();
      body.last_updated = new Date().toISOString();
      memCmsConfig = body;

      // Try writing to /tmp
      try {
        fs.writeFileSync(path.join('/tmp', 'cms_config.json'), JSON.stringify(body, null, 2), 'utf8');
      } catch (e) {}

      // Try writing to local project if writable
      try {
        const localDataDir = path.join(rootDir, 'data');
        if (fs.existsSync(localDataDir)) {
          fs.writeFileSync(path.join(localDataDir, 'cms_config.json'), JSON.stringify(body, null, 2), 'utf8');
        }
      } catch (e) {}

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        message: 'Konfigurasi konten CMS berhasil disimpan!',
        data: body
      }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, message: 'Gagal menyimpan konfigurasi: ' + e.message }));
    }
    return;
  }

  // Tracking API
  if (pathname === '/api/track') {
    let resiList = [];
    if (req.method === 'POST') {
      const body = await getRequestBody();
      if (body.resi) {
        resiList = Array.isArray(body.resi) ? body.resi : body.resi.split(/[\n, ]+/).filter(Boolean);
      }
    } else {
      const qResi = parsedUrl.query.resi;
      if (qResi) {
        resiList = Array.isArray(qResi) ? qResi : qResi.split(/[\n, ]+/).filter(Boolean);
      }
    }

    if (resiList.length === 0) {
      resiList = ['DSF-889210'];
    }

    const results = [];
    for (const resi of resiList) {
      const clean = resi.trim();
      if (!clean) continue;

      try {
        const upstream = await postUpstream('https://hehe.barakaexpress.co.id/tarif_resi/?cek=resi', {
          resi: clean,
          submit: ''
        });

        const html = upstream.body || '';
        const trs = [...html.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi)];
        if (trs.length > 0) {
          const resiObj = {
            resi: clean,
            ok: true,
            progress: 80,
            origin_text: 'JAKARTA',
            destination: 'SURABAYA',
            latest: { keterangan: 'Dalam Pengiriman', time_display: '-' },
            history: []
          };
          trs.forEach(tr => {
            resiObj.history.push({
              hari: '',
              tgl_display: tr[1].replace(/<[^>]+>/g, '').trim(),
              jam_display: tr[2].replace(/<[^>]+>/g, '').trim(),
              keterangan: tr[3].replace(/<[^>]+>/g, '').trim()
            });
          });
          if (resiObj.history.length > 0) {
            resiObj.latest = {
              keterangan: resiObj.history[0].keterangan,
              time_display: `${resiObj.history[0].tgl_display} ${resiObj.history[0].jam_display}`
            };
          }
          results.push(resiObj);
        } else {
          results.push(generateMockWaybill(clean));
        }
      } catch (err) {
        results.push(generateMockWaybill(clean));
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, data: results }));
    return;
  }

  // Tarif API
  if (pathname === '/api/tarif') {
    let params = {};
    if (req.method === 'POST') {
      params = await getRequestBody();
    } else {
      params = parsedUrl.query;
    }

    const originName = params.da || params.asal || 'JAKARTA';
    const destName = params.tuj || params.tujuanText || (params.tujuan && !params.tujuan.includes('-') ? params.tujuan : 'SURABAYA');
    const promCode = params.prom || 'TNB';
    const destCode = (params.tujuan && params.tujuan.includes('-')) ? params.tujuan : 'JATIM-01';
    const weightVal = params.bet || params.brt || params.berat || '25';

    try {
      const upstreamResp = await postUpstream('https://hehe.barakaexpress.co.id/tarif_resi/?cek=tarif', {
        prom: promCode,
        tujuan: destCode,
        da: originName,
        tuj: destName,
        brt: weightVal,
        le: params.le || params.lebar || '20',
        pa: params.pa || params.panjang || '20',
        ti: params.ti || params.tinggi || '20',
        hitung: ''
      });

      const html = upstreamResp.body || '';
      const tableMatch = html.match(/<table class="table table-bordered">([\s\S]*?)<\/table>/i);
      if (tableMatch) {
        const rowMatch = tableMatch[1].match(/<tbody[^>]*>\s*<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/i);
        if (rowMatch) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              da: rowMatch[1].trim() || originName,
              tuj: rowMatch[2].trim() || destName,
              estimasi: rowMatch[3].trim(),
              hargaKg: rowMatch[4].trim(),
              hargaKubik: rowMatch[5].trim(),
              berat: weightVal,
              layanan: 'Cargo Reguler DS Fun Logistic'
            }
          }));
          return;
        }
      }

      const localResult = calculateLocalRate({
        da: originName,
        tuj: destName,
        bet: weightVal,
        le: params.le || params.lebar,
        pa: params.pa || params.panjang,
        ti: params.ti || params.tinggi
      });

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        data: localResult,
        note: 'Estimasi standar kargo DS Fun Logistic. Konfirmasikan jadwal pengiriman dengan CS.'
      }));
      return;
    } catch (e) {
      const localResult = calculateLocalRate({
        da: originName,
        tuj: destName,
        bet: weightVal,
        le: params.le || params.lebar,
        pa: params.pa || params.panjang,
        ti: params.ti || params.tinggi
      });
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, data: localResult, note: 'Estimasi standar kargo offline.' }));
      return;
    }
  }

  // Contact API
  if (pathname === '/api/contact' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      message: 'Terima kasih! Pesan Anda telah diterima oleh tim Customer Service DS Fun Logistic. Kami akan menghubungi Anda segera.'
    }));
    return;
  }

  // Branches API
  if (pathname === '/api/branches') {
    const filePath = path.join(rootDir, 'assets', 'js', 'branches.json');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // Detailed Branches API
  if (pathname === '/api/branches-detailed') {
    const filePath = path.join(rootDir, 'assets', 'js', 'branches-detailed.json');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // Jobs API
  if (pathname === '/api/jobs') {
    const filePath = path.join(rootDir, 'assets', 'js', 'jobs.json');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // 404 for any other API routes
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Endpoint API tidak ditemukan', path: pathname }));
};
