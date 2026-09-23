// ==========================================================
// DS FUN LOGISTIC WAYBILL TRACKING JS
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  // Support dynamic multi-inputs on track forms
  const trackInputsContainer = document.getElementById('trackInputsContainer');
  const btnAddResi = document.getElementById('btnAddResi');

  if (btnAddResi && trackInputsContainer) {
    btnAddResi.addEventListener('click', () => {
      const currentRows = trackInputsContainer.querySelectorAll('.track-input-row');
      if (currentRows.length >= 3) return;

      const newRow = document.createElement('div');
      newRow.className = 'track-input-row';
      newRow.innerHTML = `
        <input type="text" name="resi[]" placeholder="Nomor waybill / resi lainnya" class="form-control" autocomplete="off" oninput="this.value = this.value.toUpperCase()">
        <button type="button" class="btn-remove-row" aria-label="Hapus Input">&times;</button>
      `;
      trackInputsContainer.appendChild(newRow);
      newRow.querySelector('input').focus();

      if (trackInputsContainer.querySelectorAll('.track-input-row').length >= 3) {
        btnAddResi.disabled = true;
      }
    });

    trackInputsContainer.addEventListener('click', (e) => {
      if (e.target.matches('.btn-remove-row')) {
        const rows = trackInputsContainer.querySelectorAll('.track-input-row');
        if (rows.length > 1) {
          e.target.closest('.track-input-row').remove();
        } else {
          rows[0].querySelector('input').value = '';
          rows[0].querySelector('input').focus();
        }
        if (trackInputsContainer.querySelectorAll('.track-input-row').length < 3) {
          btnAddResi.disabled = false;
        }
      }
    });
  }

  // Handle Form Submission
  const trackForms = [document.getElementById('mainTrackForm'), document.getElementById('quickTrackForm')].filter(Boolean);

  trackForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultsContainer = document.getElementById('trackingResults') || document.getElementById('quickTrackingResults');
      if (!resultsContainer) return;

      const inputs = form.querySelectorAll('input[name="resi[]"], input[name="resi"], input[name="search"]');
      const resiList = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);

      if (resiList.length === 0) {
        alert('Silakan masukkan nomor resi / waybill terlebih dahulu.');
        return;
      }

      // Show Loading Skeleton
      resultsContainer.innerHTML = `
        <div style="padding: 30px; text-align: center; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div class="spinner" style="margin: 0 auto 16px; width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top-color: #D0021B; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <p style="font-weight: 600; color: #0A4FC4;">Sedang melacak nomor resi di sistem DS Fun Logistic...</p>
        </div>
      `;

      try {
        const resp = await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resi: resiList })
        });
        const res = await resp.json();

        if (res.success && res.data && res.data.length > 0) {
          renderTrackingResults(resultsContainer, res.data);
        } else {
          resultsContainer.innerHTML = `
            <div style="padding: 24px; background: #fff5f5; border: 1.5px solid #feb2b2; border-radius: 12px; color: #c53030; text-align: center;">
              <strong>Nomor resi tidak ditemukan</strong>
              <p style="margin-top: 6px; font-size: 14px;">Pastikan nomor waybill sudah benar dan tidak ada spasi di belakang angka.</p>
            </div>
          `;
        }
      } catch (err) {
        resultsContainer.innerHTML = `
          <div style="padding: 24px; background: #fff5f5; border: 1.5px solid #feb2b2; border-radius: 12px; color: #c53030; text-align: center;">
            <strong>Koneksi Gagal</strong>
            <p style="margin-top: 6px; font-size: 14px;">Terjadi kendala saat menghubungi server pelacakan. Silakan coba kembali.</p>
          </div>
        `;
      }
    });
  });

  // Check URL query parameter: ?resi=...
  const urlParams = new URLSearchParams(window.location.search);
  const qResi = urlParams.get('resi') || urlParams.get('search');
  if (qResi) {
    const input = document.querySelector('input[name="resi[]"], input[name="resi"], input[name="search"]');
    if (input) {
      input.value = qResi;
      const form = input.closest('form');
      if (form) form.dispatchEvent(new Event('submit'));
    }
  }
});

function renderTrackingResults(container, list) {
  container.innerHTML = '';

  list.forEach(item => {
    if (!item.ok) {
      container.insertAdjacentHTML('beforeend', `
        <div class="track-result-card" style="border-left: 4px solid #ef4444; padding: 24px;">
          <div style="font-size: 17px; font-weight: 700; color: #991b1b; margin-bottom: 8px;">
            Waybill: ${escapeHtml(item.resi)}
          </div>
          <p style="color: #64748b; font-size: 14.5px;">${escapeHtml(item.message || 'Nomor resi tidak terdaftar / salah.')}</p>
        </div>
      `);
      return;
    }

    // Build timeline
    let timelineHtml = '';
    let lastDate = '';
    let groupOpen = false;

    (item.history || []).forEach((h, idx) => {
      const dateKey = (h.hari || '') + '|' + (h.tgl_display || '');
      if (dateKey !== lastDate) {
        if (groupOpen) timelineHtml += '</div></div>';
        lastDate = dateKey;
        const dateLabel = (h.hari ? h.hari + ', ' : '') + (h.tgl_display || 'Tanggal Pengiriman');
        timelineHtml += `
          <div class="timeline-group">
            <div class="timeline-date-sep">${escapeHtml(dateLabel)}</div>
            <div class="timeline-items">
        `;
        groupOpen = true;
      }

      const isLatest = idx === 0;
      timelineHtml += `
        <div class="timeline-item ${isLatest ? 'latest' : ''}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">${escapeHtml(h.jam_display || '--:--')} WIB</div>
            <div class="timeline-desc">${escapeHtml(h.keterangan || '')}</div>
          </div>
        </div>
      `;
    });

    if (groupOpen) timelineHtml += '</div></div>';

    const cardHtml = `
      <div class="track-result-card" id="card_${escapeHtml(item.resi)}">
        <div class="track-card-header">
          <div class="track-waybill-badge">
            <span style="font-size: 14px; font-weight: 500; color: #64748b;">No. Waybill:</span> 
            <strong style="color: #0A4FC4;">${escapeHtml(item.resi)}</strong>
          </div>
          <div class="track-btnline">
            <button type="button" class="track-action-btn" onclick="copyResi('${escapeHtml(item.resi)}', this)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Salin Resi</span>
            </button>
            <button type="button" class="track-action-btn btn-wa" onclick="shareToWA('${escapeHtml(item.resi)}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
              <span>Bagikan WA</span>
            </button>
            <button type="button" class="track-action-btn btn-cs" onclick="contactCS('${escapeHtml(item.resi)}')">
              <span>Hubungi CS</span>
            </button>
          </div>
        </div>

        <div class="track-progress-bar">
          <div class="track-progress-fill" style="width: ${item.progress || 80}%"></div>
        </div>

        <div class="track-card-body">
          <div class="track-meta-grid">
            <div>
              <div class="meta-box-label">Kota Asal</div>
              <div class="meta-box-val">${escapeHtml(item.origin_text || '-')}</div>
            </div>
            <div>
              <div class="meta-box-label">Kota Tujuan</div>
              <div class="meta-box-val">${escapeHtml(item.destination || '-')}</div>
            </div>
            <div>
              <div class="meta-box-label">Status Terkini</div>
              <div class="meta-box-val" style="color: #0d9488;">
                ${escapeHtml(item.latest?.keterangan || '-')}
              </div>
            </div>
            <div>
              <div class="meta-box-label">Update Terakhir</div>
              <div class="meta-box-val">${escapeHtml(item.latest?.time_display || '-')}</div>
            </div>
          </div>

          <h3 class="timeline-section-title">Riwayat Perjalanan Paket</h3>
          <div class="timeline-list">
            ${timelineHtml}
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyResi(resi, btn) {
  navigator.clipboard.writeText(resi).then(() => {
    const span = btn.querySelector('span');
    const orig = span.textContent;
    span.textContent = 'Tersalin!';
    btn.style.background = '#e0f2fe';
    setTimeout(() => {
      span.textContent = orig;
      btn.style.background = '';
    }, 1500);
  });
}

function shareToWA(resi) {
  const card = document.getElementById('card_' + resi);
  let text = `Pelacakan Paket DS Fun Logistic\nNomor Waybill: ${resi}\n`;
  if (card) {
    const status = card.querySelector('.meta-box-val') ? card.querySelectorAll('.meta-box-val')[2].textContent.trim() : '';
    text += `Status: ${status}\n`;
  }
  text += `Cek detail di: ${window.location.origin}/cek-resi.html?resi=${encodeURIComponent(resi)}`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function contactCS(resi) {
  const phone = '628100000000';
  const text = `Halo Customer Service DS Fun Logistic, saya ingin bertanya terkait pengiriman paket dengan resi waybill: ${resi}. Mohon bantuannya.`;
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Spin animation
const styleSheet = document.createElement("style");
styleSheet.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);
