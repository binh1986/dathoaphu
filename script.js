// =========================
// 1. KHỞI TẠO BẢN ĐỒ MAPBOX
// =========================

// Token Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoiYmluaDg2IiwiYSI6ImNtNWtma2I3azBqOTIybHNmcDNldWQ3dTkifQ.obH8v6Lfuy8tfVeZmfBGcA';

// Tạo bản đồ nền
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  projection: 'globe',
  zoom: 8,
  center: [108.11424446587102, 12.880850957736499]
});

const DEFAULT_ZOOM = 5; // chỉnh 13, 15 tùy anh

// =========================
// 2. ĐỊNH VỊ GPS + POPUP VỊ TRÍ
// =========================

const geolocate = new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: false,
  showUserHeading: false
});

let userPopup = null;

// Khi định vị được
geolocate.on('geolocate', function (e) {
  const userCoords = [e.coords.longitude, e.coords.latitude];
  const lngLat = { lng: userCoords[0], lat: userCoords[1] };

  map.flyTo({
    center: lngLat,
    zoom: Math.max(map.getZoom(), 13),
    duration: 800
  });

  const point = map.project(lngLat);
  map.fire('click', { lngLat: lngLat, point: point });
});

// Khi map load
map.on('load', function () {
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(geolocate, 'top-right');

  // ✅ Nút lớp bản đồ đặt sau GPS => nằm dưới GPS
  map.addControl(new GoogleLikeLayersControl(), "top-right");

  // Tự động định vị 1 lần khi load
  geolocate.trigger();
});

// =========================
// 3. ẨN/HIỆN DANH SÁCH TỈNH – HUYỆN (SIDEBAR)
// =========================

function toggletaynguyenList(id) {
  document.querySelectorAll(".tinh-list").forEach(menu => {
    if (menu.id !== id) menu.style.display = "none";
  });
  const tinhList = document.getElementById(id);
  if (tinhList) tinhList.style.display = (tinhList.style.display === "block") ? "none" : "block";
}

function toggledaklakList(id) {
  document.querySelectorAll(".huyen-list").forEach(menu => {
    if (menu.id !== id) menu.style.display = "none";
  });
  const huyenList = document.getElementById(id);
  if (huyenList) huyenList.style.display = (huyenList.style.display === "block") ? "none" : "block";
}

function hideLists() {
  document.querySelectorAll('.tinh-list, .huyen-list').forEach(menu => {
    menu.style.display = 'none';
  });
}

document.addEventListener('click', function (event) {
  const isClickInside = document.querySelector('.sidebar')?.contains(event.target);
  if (!isClickInside) hideLists();
});

// =========================
// 4. MÀU HUYỆN + BIẾN LƯU TRẠNG THÁI HOVER
// =========================

const colorMap = {
  'krongpak': '#FF5733',
  'eakar': '#84193B'
};

let hoveredFeatureId = null;

// ✅ Cache huyện đang chọn để restore sau khi đổi nền
let currentHuyen = null;      // "krongpak"
let currentGeoJSON = null;    // object GeoJSON
let currentSourceId = null;   // "krongpak"
let currentLayerId = null;    // "krongpak-layer"

// ✅ Restore layer huyện sau khi map.setStyle()
function restoreCurrentHuyenLayer() {
  if (!currentHuyen || !currentGeoJSON) return;

  // reset highlight cũ vì id sẽ đổi khi generateId
  hoveredFeatureId = null;

  const sourceId = currentSourceId;
  const layerId = currentLayerId;

  // tránh add trùng
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  map.addSource(sourceId, {
    type: "geojson",
    data: currentGeoJSON,
    generateId: true
  });

  map.addLayer({
    id: layerId,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": colorMap[currentHuyen] || "#FFFFFF",
      "fill-opacity": [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.6,
        0.2
      ],
      "fill-outline-color": "#000000"
    }
  });
}

// =========================
// 4B. MARKER KHI CLICK
// =========================

let clickMarker = null;

function setClickMarker(lngLat) {
  if (!clickMarker) {
    clickMarker = new mapboxgl.Marker({ anchor: 'bottom' })
      .setLngLat(lngLat)
      .addTo(map);
  } else {
    clickMarker.setLngLat(lngLat);
  }
}

function centerMapWithPanel(lngLat, showPanel) {
  if (!showPanel) {
    map.flyTo({
      center: lngLat,
      zoom: Math.max(map.getZoom(), 13),
      duration: 800
    });
    return;
  }

  const mapContainer = map.getContainer();
  const mapWidth = mapContainer.clientWidth;
  const mapHeight = mapContainer.clientHeight || window.innerHeight;

  const markerPoint = map.project(lngLat);

  const targetX = mapWidth / 2;
  const targetY = mapHeight * 0.3;

  const dx = targetX - markerPoint.x;
  const dy = targetY - markerPoint.y;

  const centerPoint = map.project(map.getCenter());
  centerPoint.x -= dx;
  centerPoint.y -= dy;

  const targetCenter = map.unproject(centerPoint);

  map.flyTo({
    center: targetCenter,
    zoom: Math.max(map.getZoom(), 13),
    duration: 800
  });
}

// =========================
// 5. CHỌN HUYỆN -> LOAD GEOJSON + TÔ VÙNG
// =========================

document.addEventListener("DOMContentLoaded", function () {
  const huyenRadios = document.querySelectorAll(".huyen-radio");

  huyenRadios.forEach(radio => {
    radio.addEventListener("change", function () {
      const selectedHuyen = this.value;              // "krongpak"
      const sourceId = selectedHuyen.toLowerCase();  // "krongpak"
      const layerId = sourceId + "-layer";           // "krongpak-layer"
      const geojsonFile = sourceId + ".geojson";     // "krongpak.geojson"

      if (geolocate._watchState === "ACTIVE_LOCK") {
        geolocate._clearWatch();
      }

      // Xóa tất cả layer/source huyện cũ
      huyenRadios.forEach(r => {
        const oldSourceId = r.value.toLowerCase();
        const oldLayerId = oldSourceId + "-layer";
        if (map.getLayer(oldLayerId)) map.removeLayer(oldLayerId);
        if (map.getSource(oldSourceId)) map.removeSource(oldSourceId);
      });

      fetch(geojsonFile)
        .then(response => response.json())
        .then(data => {
          // ✅ Lưu cache để đổi nền xong khôi phục
          currentHuyen = selectedHuyen;
          currentGeoJSON = data;
          currentSourceId = sourceId;
          currentLayerId = layerId;

          map.addSource(sourceId, {
            type: "geojson",
            data: data,
            generateId: true
          });

          map.addLayer({
            id: layerId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": colorMap[selectedHuyen] || "#FFFFFF",
              "fill-opacity": [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.6,
                0.2
              ],
              "fill-outline-color": "#000000"
            }
          });

          if (data.features.length > 0 && data.features[0].properties.center) {
            const center = data.features[0].properties.center;
            const zoomLevel = data.features[0].properties.zoom || 12;
            map.flyTo({ center: center, zoom: zoomLevel, duration: 1000 });
          }
        })
        .catch(error => console.error("Lỗi khi tải GeoJSON:", error));
    });
  });
});

// =========================
// 6. PANEL ĐẤT: LÊN / XUỐNG
// =========================

const soilPanel = document.getElementById('soil-panel');
let isPanelOpen = false;

function slidePanelUp() {
  if (!soilPanel) return;
  soilPanel.classList.add('panel-open');
  soilPanel.classList.remove('panel-closed', 'hidden');
  isPanelOpen = true;
}

function slidePanelDown(callback) {
  if (!soilPanel) {
    if (callback) callback();
    return;
  }

  soilPanel.classList.remove('panel-open');
  soilPanel.classList.add('panel-closed');
  isPanelOpen = false;

  if (callback) {
    const onEnd = () => {
      soilPanel.removeEventListener('transitionend', onEnd);
      callback();
    };
    soilPanel.addEventListener('transitionend', onEnd);
  }
}

// =========================
// 7. CLICK TRÊN BẢN ĐỒ -> MARKER + PANEL LÊN/XUỐNG + POPUP
// =========================

map.on("click", function (e) {
  const visibleHuyenLayers = Object.keys(colorMap)
    .map(h => h + "-layer")
    .filter(id => map.getLayer(id));

  const features = visibleHuyenLayers.length > 0
    ? map.queryRenderedFeatures(e.point, { layers: visibleHuyenLayers })
    : [];

  if (features.length > 0) {
    const feature = features[0];
    const props = feature.properties;

    setClickMarker(e.lngLat);
    centerMapWithPanel(e.lngLat, true);

    if (hoveredFeatureId !== null) {
      Object.keys(colorMap).forEach(h => {
        const srcId = h.toLowerCase();
        if (map.getSource(srcId)) {
          map.setFeatureState({ source: srcId, id: hoveredFeatureId }, { hover: false });
        }
      });
    }

    hoveredFeatureId = feature.id;
    const currentSourceId2 = feature.source;
    if (currentSourceId2) {
      map.setFeatureState({ source: currentSourceId2, id: hoveredFeatureId }, { hover: true });
    }

    if (isPanelOpen) {
      slidePanelDown(() => {
        updateSoilPanel(props);
        slidePanelUp();
      });
    } else {
      updateSoilPanel(props);
      slidePanelUp();
    }

  } else {
    setClickMarker(e.lngLat);
    centerMapWithPanel(e.lngLat, false);

    if (hoveredFeatureId !== null) {
      Object.keys(colorMap).forEach(h => {
        const srcId = h.toLowerCase();
        if (map.getSource(srcId)) {
          map.setFeatureState({ source: srcId, id: hoveredFeatureId }, { hover: false });
        }
      });
      hoveredFeatureId = null;
    }

    if (isPanelOpen) slidePanelDown();

    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="
            font-family:'Segoe UI', sans-serif;
            background:#ffffff;
            padding:14px 18px;
            border-radius:14px;
            box-shadow:0 6px 18px rgba(0,0,0,0.20);
            border:1px solid #e5e7eb;
            font-size:14px;
            line-height:1.45;
        ">
          <h3 style="
              margin:0 0 10px 0;
              font-size:16px;
              font-weight:600;
              color:#0d6efd;
          ">
            📍 Thông tin vị trí
          </h3>

          <p style="margin:6px 0; color:#1f2937;">
            <b>Kinh độ:</b> ${e.lngLat.lng.toFixed(6)}<br>
            <b>Vĩ độ:</b> ${e.lngLat.lat.toFixed(6)}
          </p>

          <p style="
              margin:8px 0 0 0;
              color:#b91c1c;
              font-weight:600;
          ">
            ⚠️ Đất nằm ngoài vùng đánh giá
          </p>
        </div>
      `)
      .addTo(map);
  }
});

// =========================
// 8. CẬP NHẬT NỘI DUNG PANEL ĐẤT
// =========================

function updateSoilPanel(props) {
  document.getElementById('sp-name').textContent = props.KH_pd || props.ID || '—';

  document.getElementById('sp-ph').textContent =
    props.pH ? `${props.pH} ${props.pH_muc || ''}` : 'Chưa có';

  document.getElementById('sp-om').textContent =
    props.Huu_co ? `${props.Huu_co} ${props.OM_muc || ''}` : 'Chưa có';

  document.getElementById('sp-cec').textContent =
    props.CEC ? `${props.CEC} ${props.CEC_muc || ''}` : 'Chưa có';

  if (props.Profile_img) {
    document.getElementById('sp-profile-img').src = props.Profile_img;
  }

  document.getElementById('KH_dat').textContent = props.KH_dat || '—';
  document.getElementById('Ten_dat').textContent = props.Ten_dat || 'Chưa có';
  document.getElementById('Tinh').textContent = props.Tinh || 'Chưa có';
  document.getElementById('Xa').textContent = props.Xa || 'Chưa có';
}

// =========================
// 9. NÚT ĐÓNG PANEL
// =========================

const closeBtn = document.getElementById('panel-close-btn');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    if (typeof slidePanelDown === "function") slidePanelDown();
    else document.getElementById('soil-panel').classList.add('hidden');
  });
}

// =========================
// 10. CHỌN LỚP BẢN ĐỒ (NÚT KIỂU GOOGLE MAPS) + RESTORE GEOJSON
// =========================

const GM_LAYERS_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 4 3 9l9 5 9-5-9-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M3 13l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M3 17l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

class GoogleLikeLayersControl {
  onAdd(map) {
    this._map = map;

    this._container = document.createElement("div");
    this._container.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
    this._container.style.position = "relative";

    this._btn = document.createElement("button");
    this._btn.type = "button";
    this._btn.title = "Lớp bản đồ";
    this._btn.setAttribute("aria-label", "Lớp bản đồ");
    this._btn.innerHTML = GM_LAYERS_ICON;

    this._menu = document.createElement("div");
    this._menu.className = "gm-layer-menu";
    this._menu.hidden = true;

    const styles = [
      { name: "Vệ tinh + Đường", url: "mapbox://styles/mapbox/satellite-streets-v12" },
      { name: "Vệ tinh",         url: "mapbox://styles/mapbox/satellite-v9" },
      { name: "Đường phố",       url: "mapbox://styles/mapbox/streets-v12" },
      { name: "Địa hình",        url: "mapbox://styles/mapbox/outdoors-v12" },
      { name: "Sáng",            url: "mapbox://styles/mapbox/light-v11" },
      { name: "Tối",             url: "mapbox://styles/mapbox/dark-v11" }
    ];

    styles.forEach(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.name;
      b.dataset.styleUrl = s.url;
      this._menu.appendChild(b);
    });

    this._btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._menu.hidden = !this._menu.hidden;
    });

    this._menu.addEventListener("click", (e) => {
      const item = e.target.closest("button");
      if (!item) return;

      const cam = {
        center: this._map.getCenter(),
        zoom: this._map.getZoom(),
        bearing: this._map.getBearing(),
        pitch: this._map.getPitch()
      };

      [...this._menu.querySelectorAll("button")].forEach(x => x.classList.remove("active"));
      item.classList.add("active");

      this._map.setStyle(item.dataset.styleUrl);

      this._map.once("style.load", () => {
        this._map.jumpTo(cam);

        // ✅ quan trọng: restore huyện đang chọn sau khi đổi nền
        restoreCurrentHuyenLayer();
      });

      this._menu.hidden = true;
    });

    document.addEventListener("click", () => { this._menu.hidden = true; });

    this._container.appendChild(this._btn);
    this._container.appendChild(this._menu);
    return this._container;
  }

  onRemove() {
    this._container?.parentNode?.removeChild(this._container);
    this._map = null;
  }
}
