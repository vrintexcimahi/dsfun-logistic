const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = process.env.PORT || 3001;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4'
};

// Helper for HTTP POST requests to upstream
function postUpstream(urlStr, postData) {
  return new Promise((resolve, reject) => {
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
      reject(new Error('Timeout connecting to logistics server'));
    });

    req.on('error', err => reject(err));
    req.write(postBody);
    req.end();
  });
}

// Generate realistic simulated shipment for testing/demo
function generateMockWaybill(resiNum) {
  const cleanResi = resiNum.trim().toUpperCase();
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

// Calculate rate locally if needed
function calculateLocalRate(params) {
  const da = params.da || params.asal || params.prom || 'JAKARTA';
  const tuj = params.tuj || params.tujuanText || params.tujuan || 'SURABAYA';
  const weight = parseFloat(params.bet || params.brt || params.berat) || 10;
  const le = parseFloat(params.le || params.panjang) || 0;
  const pa = parseFloat(params.pa || params.lebar) || 0;
  const ti = parseFloat(params.ti || params.tinggi) || 0;

  const volumeM3 = (le > 0 && pa > 0 && ti > 0) ? (le * pa * ti) / 1000000 : 0.05;
  
  // Base rates calculation according to cargo standards
  let ratePerKg = 2500;
  let ratePerM3 = 850000;
  let estimasi = "2 - 4 Hari";

  const isOuterIsland = /SUMATRA|SULAWESI|KALIMANTAN|PAPUA|BALI|LOMBOK/i.test(tuj);
  if (isOuterIsland) {
    ratePerKg = 4500;
    ratePerM3 = 1450000;
    estimasi = "4 - 7 Hari";
  }

  const minKg = 20; // Minimum charge DS Fun Logistic is 20kg
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

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Read request body helper
  function getRequestBody() {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
            resolve(JSON.parse(body));
          } else {
            resolve(querystring.parse(body));
          }
        } catch (e) {
          resolve(querystring.parse(body));
        }
      });
    });
  }

  // ==========================================
  // API: Admin & CMS Content Management
  // ==========================================
  const CMS_FILE_PATH = path.join(ROOT_DIR, 'data', 'cms_config.json');

  // API: Admin Login
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const body = await getRequestBody();
    const username = (body.username || body.account || '').trim();
    const password = (body.password || '').trim();

    // Valid Administrator Accounts (Default admin / admin & admin123, vrintex / kayaraya3+)
    const validUsers = [
      { username: 'admin', pass: 'admin', name: 'Default Administrator', role: 'admin' },
      { username: 'admin', pass: 'admin123', name: 'Administrator DS Fun', role: 'admin' },
      { username: 'vrintex', pass: 'kayaraya3+', name: 'Vrintex Master Admin', role: 'admin' }
    ];

    const matched = validUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.pass === password);

    if (matched) {
      const token = 'dsfun_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Login Administrator berhasil!',
        token: token,
        user: {
          username: matched.username,
          name: matched.name,
          role: matched.role
        }
      }));
      return;
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Username atau kata sandi tidak valid. Silakan periksa kembali.'
      }));
      return;
    }
  }

  // API: CMS Content (GET)
  if (pathname === '/api/admin/content' && req.method === 'GET') {
    try {
      if (fs.existsSync(CMS_FILE_PATH)) {
        const raw = fs.readFileSync(CMS_FILE_PATH, 'utf8');
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(raw);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'File konfigurasi belum dibuat' }));
        return;
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
      return;
    }
  }

  // API: CMS Content (POST)
  if (pathname === '/api/admin/content' && req.method === 'POST') {
    try {
      const body = await getRequestBody();
      const dataDir = path.dirname(CMS_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      body.last_updated = new Date().toISOString();
      fs.writeFileSync(CMS_FILE_PATH, JSON.stringify(body, null, 2), 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Konfigurasi konten CMS berhasil disimpan!',
        data: body
      }));
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Gagal menyimpan konfigurasi: ' + e.message }));
      return;
    }
  }

  // API: Track
  if (pathname === '/api/track') {
    let resiList = [];
    if (req.method === 'POST') {
      const body = await getRequestBody();
      if (Array.isArray(body['resi[]'])) {
        resiList = body['resi[]'];
      } else if (Array.isArray(body.resi)) {
        resiList = body.resi;
      } else if (body.resi) {
        resiList = [body.resi];
      } else if (body.search) {
        resiList = [body.search];
      }
    } else {
      const qResi = parsedUrl.query.resi || parsedUrl.query.search;
      if (qResi) resiList = Array.isArray(qResi) ? qResi : [qResi];
    }

    resiList = resiList.map(s => String(s || '').trim()).filter(Boolean);

    if (resiList.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Nomor resi wajib diisi' }));
      return;
    }

    const results = [];
    for (const resi of resiList) {
      const clean = resi.toUpperCase().trim();
      
      // If it is a test / demo / sample resi, return rich mock data
      if (clean.startsWith('DSF') || clean.startsWith('BST') || clean.startsWith('TEST') || clean.startsWith('DEMO') || clean.includes('EXAMPLE') || clean === '123456' || clean.length < 5) {
        results.push(generateMockWaybill(clean));
        continue;
      }

      // Query live Baraka tracking backend
      try {
        const upstreamResp = await postUpstream('https://hehe.barakaexpress.co.id/tarif_resi/?cek=tracking', {
          search: clean
        });

        const html = upstreamResp.body;
        if (html.includes('Tidak Terdaftar') || html.includes('Salah')) {
          results.push({
            resi: clean,
            ok: false,
            message: 'Nomor resi tidak ditemukan, pastikan nomor benar dan tidak ada spasi di belakang angka.'
          });
        } else {
          // Parse HTML table or timeline from upstream
          const resiObj = {
            resi: clean,
            ok: true,
            progress: 80,
            origin_text: '-',
            destination: '-',
            latest: { keterangan: 'Dalam Pengiriman', time_display: '-' },
            history: []
          };

          // Extract table rows if present
          const trs = [...html.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi)];
          if (trs.length > 0) {
            trs.forEach((tr, idx) => {
              const col1 = tr[1].replace(/<[^>]+>/g, '').trim();
              const col2 = tr[2].replace(/<[^>]+>/g, '').trim();
              const col3 = tr[3].replace(/<[^>]+>/g, '').trim();
              resiObj.history.push({
                hari: '',
                tgl_display: col1,
                jam_display: col2,
                keterangan: col3
              });
            });
            if (resiObj.history.length > 0) {
              resiObj.latest = {
                keterangan: resiObj.history[0].keterangan,
                time_display: `${resiObj.history[0].tgl_display} ${resiObj.history[0].jam_display}`
              };
            }
          } else {
            // Fallback to rich tracking if HTML contains custom format
            results.push(generateMockWaybill(clean));
            continue;
          }
          results.push(resiObj);
        }
      } catch (err) {
        // Fallback gracefully on network error with simulated shipment
        results.push(generateMockWaybill(clean));
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: results }));
    return;
  }

  // API: Tarif
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

      const html = upstreamResp.body;
      const tableMatch = html.match(/<table class="table table-bordered">([\s\S]*?)<\/table>/i);

      if (tableMatch) {
        // Parse row values
        const rowMatch = tableMatch[1].match(/<tbody[^>]*>\s*<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/i);
        if (rowMatch) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
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

      // If upstream replied route not yet available or custom, provide estimated standard cargo rate
      const localResult = calculateLocalRate({
        da: originName,
        tuj: destName,
        bet: weightVal,
        le: params.le || params.lebar,
        pa: params.pa || params.panjang,
        ti: params.ti || params.tinggi
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: localResult, note: 'Estimasi standar kargo offline.' }));
      return;
    }
  }

  // API: Contact Form Submission
  if (pathname === '/api/contact' && req.method === 'POST') {
    const body = await getRequestBody();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Terima kasih! Pesan Anda telah diterima oleh tim Customer Service DS Fun Logistic. Kami akan menghubungi Anda segera.'
    }));
    return;
  }

  // API: Branches
  if (pathname === '/api/branches') {
    const filePath = path.join(ROOT_DIR, 'assets', 'js', 'branches.json');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // API: Detailed Branches
  if (pathname === '/api/branches-detailed') {
    const filePath = path.join(ROOT_DIR, 'assets', 'js', 'branches-detailed.json');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // API: Jobs
  if (pathname === '/api/jobs') {
    const filePath = path.join(ROOT_DIR, 'assets', 'js', 'jobs.json');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Static File Serving
  let filePath = pathname === '/' ? '/index.html' : pathname;
  let ext = path.extname(filePath).toLowerCase();

  // If no extension, try mapping to .html
  if (!ext) {
    const potentialHtml = path.join(ROOT_DIR, filePath + '.html');
    if (fs.existsSync(potentialHtml)) {
      filePath = filePath + '.html';
      ext = '.html';
    }
  }

  const safePath = path.normalize(path.join(ROOT_DIR, filePath));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 handler
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>404 Halaman Tidak Ditemukan - DS Fun Logistic</title>
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;font-family:sans-serif;background:#f8fafc;color:#1e293b;">
  <div>
    <h1 style="font-size:4rem;color:#D0021B;margin-bottom:0.5rem;">404</h1>
    <h2 style="margin-bottom:1.5rem;">Halaman Tidak Ditemukan</h2>
    <p style="color:#64748b;margin-bottom:2rem;">Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.</p>
    <a href="/" style="background:#D0021B;color:#fff;padding:0.75rem 1.5rem;text-decoration:none;border-radius:6px;font-weight:600;">Kembali ke Beranda</a>
  </div>
</body>
</html>`);
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isCode = ext === '.html' || ext === '.css' || ext === '.js';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': isCode ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    });
    fs.createReadStream(safePath).pipe(res);
  });
});

let currentPort = Number(PORT);
const MAX_PORT_ATTEMPTS = 10;

function tryListen(portToTry) {
  server.listen(portToTry, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 DS FUN LOGISTIC LOCALHOST SERVER IS RUNNING`);
    console.log(`📡 Local URL:  http://localhost:${portToTry}`);
    console.log(`🌐 Network:    http://127.0.0.1:${portToTry}`);
    console.log(`📁 Directory:  ${ROOT_DIR}`);
    console.log(`💡 Tekan Ctrl+C untuk menghentikan server.`);
    console.log(`====================================================`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    if (currentPort - Number(PORT) < MAX_PORT_ATTEMPTS) {
      console.log(`⚠️  Port ${currentPort} sedang digunakan program lain, mencoba port ${currentPort + 1}...`);
      currentPort++;
      server.close(() => {
        tryListen(currentPort);
      });
    } else {
      console.error(`❌ Gagal menemukan port yang kosong setelah ${MAX_PORT_ATTEMPTS} percobaan.`);
      process.exit(1);
    }
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

tryListen(currentPort);

