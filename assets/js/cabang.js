// ==========================================================
// DS FUN LOGISTIC CABANG & LOCATOR JS
// ==========================================================

let mapInstance = null;
let allPoints = [];
let allDetailedBranches = [];

document.addEventListener('DOMContentLoaded', async () => {
  const mapContainer = document.getElementById('map-container');
  const searchInput = document.getElementById('branchSearchInput');
  const provFiltersContainer = document.getElementById('provinceFilters');
  const branchListContainer = document.getElementById('branchTableBody');

  // 1. Fetch Coordinates Points
  try {
    const pResp = await fetch('/assets/js/branches.json');
    allPoints = await pResp.json();
  } catch (e) {
    console.warn('Could not load branches.json');
  }

  // 2. Fetch Detailed Branch List
  try {
    const dResp = await fetch('/assets/js/branches-detailed.json');
    allDetailedBranches = await dResp.json();
  } catch (e) {
    console.warn('Could not load branches-detailed.json');
  }

  // 3. Initialize Leaflet Map
  if (mapContainer && typeof L !== 'undefined') {
    mapInstance = L.map('map-container').setView([-2.5489, 118.0149], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | DS Fun Logistic',
      maxZoom: 18
    }).addTo(mapInstance);

    // Plot branch markers
    allPoints.forEach(p => {
      const lat = parseFloat(p[2]);
      const lng = parseFloat(p[3]);
      const name = p[1];
      const mapUrl = p[4];

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const marker = L.marker([lat, lng]);
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px;">
            <strong style="color: #0A4FC4; font-size: 14px;">DS Fun Logistic ${name}</strong><br>
            <p style="margin: 4px 0 8px; color: #64748b;">Cabang / Agen Resmi</p>
            ${mapUrl && mapUrl !== '-' ? `<a href="${mapUrl}" target="_blank" style="display:inline-block; background:#0A4FC4; color:#fff; padding:4px 10px; border-radius:4px; font-weight:600; font-size:12px;">Petunjuk Arah (Maps)</a>` : ''}
          </div>
        `;
        marker.bindPopup(popupHtml);
        marker.addTo(mapInstance);
      }
    });
  }

  // 4. Render Province Filter Pills
  if (provFiltersContainer && allDetailedBranches.length > 0) {
    provFiltersContainer.innerHTML = `<button type="button" class="prov-pill active" data-prov="ALL">Semua Wilayah (${countTotalBranches()})</button>`;
    allDetailedBranches.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prov-pill';
      btn.setAttribute('data-prov', p.province);
      btn.textContent = `${p.province} (${p.branches.length})`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.prov-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderBranchTable(p.province, searchInput ? searchInput.value : '');
      });
      provFiltersContainer.appendChild(btn);
    });

    const allBtn = provFiltersContainer.querySelector('[data-prov="ALL"]');
    if (allBtn) {
      allBtn.addEventListener('click', () => {
        document.querySelectorAll('.prov-pill').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        renderBranchTable('ALL', searchInput ? searchInput.value : '');
      });
    }
  }

  // 5. Initial Table Render
  renderBranchTable('ALL', '');

  // 6. Search Filter
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const activePill = document.querySelector('.prov-pill.active');
      const activeProv = activePill ? activePill.getAttribute('data-prov') : 'ALL';
      renderBranchTable(activeProv, searchInput.value);
    });
  }

  function countTotalBranches() {
    return allDetailedBranches.reduce((acc, curr) => acc + curr.branches.length, 0);
  }

  function renderBranchTable(selectedProv, searchQuery) {
    if (!branchListContainer) return;

    let filtered = [];
    allDetailedBranches.forEach(p => {
      if (selectedProv === 'ALL' || p.province.toLowerCase() === selectedProv.toLowerCase()) {
        p.branches.forEach(b => {
          filtered.push({
            ...b,
            province: p.province
          });
        });
      }
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(b => 
        b.name.toLowerCase().includes(q) || 
        b.address.toLowerCase().includes(q) || 
        b.province.toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      branchListContainer.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: #64748b;">
            Tidak ada cabang atau agen yang sesuai dengan pencarian "<strong>${searchQuery}</strong>".
          </td>
        </tr>
      `;
      return;
    }

    branchListContainer.innerHTML = filtered.map((b, idx) => `
      <tr>
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>
          <strong style="color: #0A4FC4; font-size: 15px;">DS Fun ${escapeHtml(b.name)}</strong>
          <span style="display:block; font-size: 11.5px; color: #64748b; font-weight:600;">${escapeHtml(b.province)}</span>
        </td>
        <td style="font-size: 13.5px; color: #334155; max-width: 380px;">${escapeHtml(b.address)}</td>
        <td>
          ${b.phone && b.phone !== '-' ? `
            <a href="https://api.whatsapp.com/send?phone=${cleanPhone(b.phone)}&text=Halo%20DS%20Fun%20Logistic%20${encodeURIComponent(b.name)}" target="_blank" style="color: #25d366; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              ${escapeHtml(b.phone)}
            </a>
          ` : '<span style="color:#94a3b8;">-</span>'}
        </td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; background: #dcfce7; color: #15803d;">Aktif</span>
        </td>
        <td>
          ${b.mapUrl && b.mapUrl !== '-' ? `
            <a href="${escapeHtml(b.mapUrl)}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 12px;">
              Buka Maps
            </a>
          ` : '<span style="color:#94a3b8;">-</span>'}
        </td>
      </tr>
    `).join('');
  }

  function cleanPhone(p) {
    let clean = p.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return clean;
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
