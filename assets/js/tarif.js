// ==========================================================
// DS FUN LOGISTIC TARIF CALCULATOR JS
// ==========================================================

document.addEventListener('DOMContentLoaded', async () => {
  const fromSelects = document.querySelectorAll('select[name="prom"], select#tarif-from');
  const toSelects = document.querySelectorAll('select[name="tujuan"], select#tarif-to');

  // Load Tarif Route Data
  try {
    const res = await fetch('/assets/js/tarif-data.json');
    const data = await res.json();

    if (data.origins && data.destinations) {
      populateSelectOptions(fromSelects, data.origins, 'Pilih Kota Asal');
      populateSelectOptions(toSelects, data.destinations, 'Pilih Kota Tujuan');
    }
  } catch (e) {
    console.warn('Using default route options');
  }

  function populateSelectOptions(selectList, groups, placeholder) {
    selectList.forEach(select => {
      select.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
      groups.forEach(g => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = g.group;
        g.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.code;
          option.textContent = opt.name;
          option.setAttribute('data-name', opt.name);
          optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
      });
    });
  }

  // Handle hidden text tracking
  document.body.addEventListener('change', (e) => {
    if (e.target.matches('select[name="prom"], select#tarif-from')) {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const form = e.target.closest('form');
      const daInput = form.querySelector('input[name="da"]');
      if (daInput && selectedOption) {
        daInput.value = selectedOption.getAttribute('data-name') || selectedOption.text;
      }
    }

    if (e.target.matches('select[name="tujuan"], select#tarif-to')) {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const form = e.target.closest('form');
      const tujInput = form.querySelector('input[name="tuj"]');
      if (tujInput && selectedOption) {
        tujInput.value = selectedOption.getAttribute('data-name') || selectedOption.text;
      }
    }
  });

  // Handle Tarif Form Submissions
  const tarifForms = [document.getElementById('mainTarifForm'), document.getElementById('quickTarifForm')].filter(Boolean);

  tarifForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultsContainer = document.getElementById('tarifResults') || document.getElementById('quickTarifResults');
      if (!resultsContainer) return;

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      // Ensure city names
      const fromSel = form.querySelector('select[name="prom"]');
      const toSel = form.querySelector('select[name="tujuan"]');
      if (fromSel && fromSel.selectedIndex >= 0) {
        payload.da = fromSel.options[fromSel.selectedIndex].getAttribute('data-name') || fromSel.options[fromSel.selectedIndex].text;
      }
      if (toSel && toSel.selectedIndex >= 0) {
        payload.tuj = toSel.options[toSel.selectedIndex].getAttribute('data-name') || toSel.options[toSel.selectedIndex].text;
      }

      if (!payload.prom || !payload.tujuan) {
        alert('Silakan pilih kota asal dan kota tujuan pengiriman.');
        return;
      }

      resultsContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div class="spinner" style="margin: 0 auto 12px; width: 36px; height: 36px; border: 3px solid #f1f5f9; border-top-color: #D0021B; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <p style="font-weight: 600; color: #0A4FC4;">Menghitung estimasi tarif DS Fun Logistic...</p>
        </div>
      `;

      try {
        const resp = await fetch('/api/tarif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const res = await resp.json();

        if (res.success && res.data) {
          renderTarifResult(resultsContainer, res.data, payload);
        } else {
          resultsContainer.innerHTML = `
            <div style="padding: 20px; background: #fffbe6; border: 1.5px solid #ffe58f; border-radius: 12px; color: #d46b08; text-align: center;">
              <strong>Rute Khusus</strong>
              <p style="margin-top: 6px; font-size: 14px;">${escapeHtml(res.message || 'Rute langsung belum terdaftar di sistem online.')}</p>
              <a href="https://api.whatsapp.com/send?phone=628100000000&text=Halo%20DS%20Fun%20Logistic,%20saya%20ingin%20cek%20tarif%20dari%20${encodeURIComponent(payload.da)}%20ke%20${encodeURIComponent(payload.tuj)}" target="_blank" class="btn btn-accent btn-sm" style="margin-top: 12px; display: inline-flex;">
                Tanya Tarif Langsung ke CS via WA
              </a>
            </div>
          `;
        }
      } catch (err) {
        resultsContainer.innerHTML = `
          <div style="padding: 20px; background: #fff5f5; border: 1.5px solid #feb2b2; border-radius: 12px; color: #c53030; text-align: center;">
            <strong>Gagal Memuat Tarif</strong>
            <p style="margin-top: 6px; font-size: 14px;">Terjadi kendala jaringan. Silakan hubungi CS kami via WhatsApp.</p>
          </div>
        `;
      }
    });
  });
});

function renderTarifResult(container, data, req) {
  const berat = req.bet || req.brt || '20';
  const waMsg = `Halo DS Fun Logistic, saya ingin memesan pengiriman kargo dari *${data.da || req.da}* menuju *${data.tuj || req.tuj}* seberat ${berat}kg. Estimasi tarif: ${data.hargaKg || '-'}. Mohon informasi penjemputan barang.`;

  container.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; border: 1.5px solid #0A4FC4; overflow: hidden; box-shadow: 0 4px 15px rgba(0,47,112,0.1);">
      <div style="background: #0A4FC4; color: #ffffff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <span style="font-weight: 700; font-size: 15px;">Hasil Perhitungan Tarif Cargo</span>
        <span style="background: #ffb703; color: #001c45; font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 999px;">
          ${escapeHtml(data.layanan || 'Reguler')}
        </span>
      </div>

      <div style="padding: 20px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600;">KOTA ASAL</div>
            <div style="font-size: 16px; font-weight: 700; color: #0A4FC4;">${escapeHtml(data.da || req.da)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600;">KOTA TUJUAN</div>
            <div style="font-size: 16px; font-weight: 700; color: #0A4FC4;">${escapeHtml(data.tuj || req.tuj)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600;">ESTIMASI SAMPAI</div>
            <div style="font-size: 16px; font-weight: 700; color: #10b981;">${escapeHtml(data.estimasi || '2 - 4 Hari')}</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14.5px;">
            <tr>
              <td style="padding: 6px 0; color: #475569;">Berdasarkan Berat (Kilogram):</td>
              <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0A4FC4;">${escapeHtml(data.hargaKg || '-')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #475569;">Berdasarkan Kubikasi (Volume):</td>
              <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0A4FC4;">${escapeHtml(data.hargaKubik || '-')}</td>
            </tr>
          </table>
          <small style="display: block; margin-top: 8px; color: #64748b; font-size: 11.5px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
            * Tarif di atas merupakan estimasi resmi DS Fun Logistic. Biaya final ditentukan berdasarkan perbandingan terberat antara berat aktual vs berat volumetrik. Minimum charge berlaku 20 kg.
          </small>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
          <a href="https://api.whatsapp.com/send?phone=628100000000&text=${encodeURIComponent(waMsg)}" target="_blank" class="btn btn-primary" style="background: #25d366; border: none;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            Kirim Paket Sekarang via WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;
}
