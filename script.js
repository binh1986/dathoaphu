// =========================
// 1. KHỞI TẠO BẢN ĐỒ MAPBOX
// =========================

// Token Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoiYmluaDg2IiwiYSI6ImNtNWtma2I3azBqOTIybHNmcDNldWQ3dTkifQ.obH8v6Lfuy8tfVeZmfBGcA';

// Tạo bản đồ nền
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  projection: 'globe',
  zoom: 1,
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
  'eakar': '#FF5733'
};

let hoveredFeatureId = null;

// ✅ Cache huyện đang chọn để restore sau khi đổi nền
let currentHuyen = null;      // "krongpak"
let currentGeoJSON = null;    // object GeoJSON
let currentSourceId = null;   // "krongpak"
let currentLayerId = null;    // "krongpak-layer"

// thêm ranh

// =========================
// 4C. RANH HÒA PHÚ (mở cùng eakar) - tô đường màu hồng như vùng đệm
// =========================
const HOA_PHU_BOUNDARY_FILE = "Ranh_hoa_phu.geojson";
const HOA_PHU_BOUNDARY_SOURCE = "hoa_phu_boundary";
const HOA_PHU_BOUNDARY_LAYER  = "hoa_phu_boundary_line";

let hoaPhuBoundaryEnabled = false;
let hoaPhuBoundaryGeoJSON = null;

function addHoaPhuBoundary() {
  hoaPhuBoundaryEnabled = true;

  // Nếu đã có rồi thì thôi
  if (map.getLayer(HOA_PHU_BOUNDARY_LAYER) && map.getSource(HOA_PHU_BOUNDARY_SOURCE)) return;

  const addLayerNow = (data) => {
    hoaPhuBoundaryGeoJSON = data;

    // tránh add trùng
    if (map.getLayer(HOA_PHU_BOUNDARY_LAYER)) map.removeLayer(HOA_PHU_BOUNDARY_LAYER);
    if (map.getSource(HOA_PHU_BOUNDARY_SOURCE)) map.removeSource(HOA_PHU_BOUNDARY_SOURCE);

    map.addSource(HOA_PHU_BOUNDARY_SOURCE, {
      type: "geojson",
      data: data
    });

    map.addLayer({
      id: HOA_PHU_BOUNDARY_LAYER,
      type: "line",
      source: HOA_PHU_BOUNDARY_SOURCE,
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": "#ff4fa3",     // hồng (giống vùng đệm)
        "line-width": 3,
        "line-opacity": 0.95,
        "line-dasharray": [2, 1]     // nét đứt nhẹ (bỏ nếu không thích)
      }
    }, currentLayerId || undefined); // nếu muốn nằm trên vùng huyện thì bỏ tham số thứ 2
  };

  // Nếu đã fetch trước đó thì dùng lại
  if (hoaPhuBoundaryGeoJSON) {
    addLayerNow(hoaPhuBoundaryGeoJSON);
    return;
  }

  fetch(HOA_PHU_BOUNDARY_FILE)
    .then(r => r.json())
    .then(data => addLayerNow(data))
    .catch(err => console.error("Lỗi khi tải Ranh_hoa_phu.geojson:", err));
}

function removeHoaPhuBoundary() {
  hoaPhuBoundaryEnabled = false;

  if (map.getLayer(HOA_PHU_BOUNDARY_LAYER)) map.removeLayer(HOA_PHU_BOUNDARY_LAYER);
  if (map.getSource(HOA_PHU_BOUNDARY_SOURCE)) map.removeSource(HOA_PHU_BOUNDARY_SOURCE);
}

// Restore lại ranh khi đổi nền (setStyle)
function restoreHoaPhuBoundary() {

  // ✅ Nếu không phải đang chọn eakar thì đảm bảo không restore + tắt luôn
  if (String(currentHuyen || "").toLowerCase() !== "eakar") {
    removeHoaPhuBoundary();   // tắt luôn (set enabled=false, remove layer/source)
    return;
  }

  // ✅ Chỉ chạy tiếp khi ranh đang bật
  if (!hoaPhuBoundaryEnabled) return;

  // Nếu chưa có data thì gọi add để fetch
  if (!hoaPhuBoundaryGeoJSON) {
    addHoaPhuBoundary();
    return;
  }

  // add lại source/layer
  if (map.getLayer(HOA_PHU_BOUNDARY_LAYER)) map.removeLayer(HOA_PHU_BOUNDARY_LAYER);
  if (map.getSource(HOA_PHU_BOUNDARY_SOURCE)) map.removeSource(HOA_PHU_BOUNDARY_SOURCE);

  map.addSource(HOA_PHU_BOUNDARY_SOURCE, {
    type: "geojson",
    data: hoaPhuBoundaryGeoJSON
  });

  map.addLayer({
    id: HOA_PHU_BOUNDARY_LAYER,
    type: "line",
    source: HOA_PHU_BOUNDARY_SOURCE,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ff4fa3",
      "line-width": 3,
      "line-opacity": 0.95,
      "line-dasharray": [2, 1]
    }
  });


}






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

  // ✅ thêm dòng này
  restoreHoaPhuBoundary();
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
      const selectedHuyen = this.value; 
      const isHoaPhu = selectedHuyen.toLowerCase() === "eakar";

// ✅ Tắt ranh ngay lập tức nếu KHÔNG phải eakar (tránh bị tồn tại do fetch/restore)
if (!isHoaPhu) removeHoaPhuBoundary();
             // "krongpak"
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

                    // ✅ Nếu là Hòa Phú (eakar) thì mở ranh xã màu hồng
          if (selectedHuyen.toLowerCase() === "eakar") addHoaPhuBoundary();
          else removeHoaPhuBoundary();


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


    // load anh phau dien

    


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
  document.getElementById('Ten_dat').textContent = props.Ten_dat || props.ID || '—';
  document.getElementById('Kh_dat').textContent = props.Kh_dat || props.ID || '—';
  document.getElementById('Text_tang_').textContent = props.Text_tang_ || props.ID || '—';
  document.getElementById('Text_do_do').textContent = props.Text_do_do || props.ID || '—';
  document.getElementById('Text_tpcg').textContent = props.Text_tpcg || props.ID || '—';
  document.getElementById('Lv_ph').textContent = props.Lv_ph || props.ID || '—';
  document.getElementById('Text_om').textContent = props.Text_om || props.ID || '—';
  document.getElementById('Text_n').textContent = props.Text_n || props.ID || '—';
  document.getElementById('Text_p').textContent = props.Text_p || props.ID || '—';
  document.getElementById('Text_k').textContent = props.Text_k || props.ID || '—';
  



document.getElementById('Dien_tich').textContent = props.Dien_tich || props.ID || '—';


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



// Đánh giá thích nghi
// =========================
// ==================================================
// I. CHUYỂN MÃ THÍCH NGHI S1 / S2 / S3 / N → CHỮ
// ==================================================
const mucThichNghi = {
  S1: "Thích nghi cao",
  S2: "Thích nghi trung bình",
  S3: "Ít thích nghi",
  N:  "Không thích nghi"
};

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (value == null || value === "") ? "—" : value;
}

function setThichNghiById(id, rawValue) {
  if (rawValue == null || rawValue === "") {
    setTextById(id, "—");
    return;
  }
  const key = String(rawValue).toUpperCase().trim();
  setTextById(id, mucThichNghi[key] || key);
}

// ==================================================
// II. HỆ SỐ ĐỘ PHÌ N – P – K
// 1: giàu (0.9) | 2: TB (1.0) | 3: nghèo (1.1)
// ==================================================
const levelFactorByNumber = { 1: 0.9, 2: 1.0, 3: 1.1 };

function parseLevelNumber(code) {
  const m = String(code || "").match(/(\d)$/);
  return m ? Number(m[1]) : null;
}

function factorFromLv(code) {
  const n = parseLevelNumber(code);
  return levelFactorByNumber[n] ?? 1.0;
}

// ==================================================
// III. MAP CÂY ↔ TRƯỜNG THÍCH NGHI TRONG GEOJSON
// ==================================================
const cropSuitabilityField = {
  caphekd:      "Tn_caphe",
  caphekkb:     "Tn_caphe",

  tieukd:       "Tn_hotieu",
  tieuktcb:     "Tn_hotieu",

  saurienkd:    "Tn_saurien",
  saurienktcb:  "Tn_saurien",

  luathuan:     "Tn_lua",
  lualai:       "Tn_lua",

  caibap:       "Tn_rau",
  caixanh:      "Tn_rau",
  xalach:       "Tn_rau",
  hanhla:       "Tn_rau",
  ot:           "Tn_rau",
  cachua:       "Tn_rau",
  daucove:      "Tn_rau",

  maca:         "Tn_maca",
  caosu:        "Tn_caosu",
  mia:          "Tn_mia",
  bap:          "Tn_bap",
  rau:          "Tn_rau",
  lua:          "Tn_lua"

};

// ==================================================
// IV. BÓN PHÂN TỔNG QUÁT – ÁP DỤNG CHO TẤT CẢ CÂY
// ==================================================
function updateFertilizerByFertility(props) {

  // Hệ số đất
  const fN = factorFromLv(props.Lv_n || props.Lv_om);
  const fP = factorFromLv(props.Lv_p);
  const fK = factorFromLv(props.Lv_k);
  const fNPK = (fN + fP + fK) / 3;

  document.querySelectorAll(".amt").forEach(el => {
    const base = Number(el.dataset.base);
    const nutr = el.dataset.nutr;   // N | P | K | NPK
    const crop = el.dataset.crop;   // caphekd | tieukd | lua | ...

    // Không có giá trị gốc
    if (!Number.isFinite(base) || base <= 0) {
      el.textContent = "—";
      return;
    }

    // Kiểm tra thích nghi cây
    const suitField = cropSuitabilityField[crop];
    const suitValue = suitField
      ? String(props[suitField] || "").toUpperCase().trim()
      : "";

    // ❌ Không thích nghi → không bón
    if (suitValue === "N") {
      el.textContent = "—";
      return;
    }

    // Chọn hệ số theo dinh dưỡng
    const factor =
      nutr === "N"   ? fN   :
      nutr === "P"   ? fP   :
      nutr === "K"   ? fK   :
      nutr === "NPK" ? fNPK : 1.0;

const raw = base * factor;

const decimals = Number.isFinite(Number(el.dataset.decimals))
  ? Number(el.dataset.decimals)
  : 0;

el.textContent = raw.toLocaleString("vi-VN", {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals
});

  });
}

// load anh
// =========================
// ẢNH PHẪU DIỆN TỰ ĐỔI THEO KÝ HIỆU ĐẤT (Ru/Fk/Dk/Fs)
// =========================
const SOIL_IMG_FOLDER = "image/";           // thư mục ảnh của anh
const DEFAULT_SOIL_IMG = "soil_profile.jpg"; // ảnh mặc định

// các đuôi file thường gặp (ưu tiên .JPG vì anh đang dùng Ru.JPG)
const IMG_EXTS = [".JPG", ".jpg", ".png", ".jpeg", ".webp"];

// tìm Ru/Fk/Dk/Fs trong 1 chuỗi
function extractSoilSymbolFromString(v) {
  if (v == null) return null;
  const s = String(v);
  // bắt đúng Ru/Fk/Dk/Fs như 1 "từ" độc lập
  const m = s.match(/\b(Ru|Fk|Dk|Fs)\b/i);
  if (!m) return null;

  const k = m[1].toLowerCase();
  return k[0].toUpperCase() + k.slice(1); // Ru/Fk/Dk/Fs
}

// ✅ QUAN TRỌNG: quét TẤT CẢ props để tìm ký hiệu
function findSoilSymbolAnywhere(props) {
  // thử nhanh vài field hay gặp trước
  const likelyKeys = ["Ky_hieu", "KyHieu", "Kh_dat", "G", "Loai_dat", "Ten_dat", "ID_dat"];
  for (const key of likelyKeys) {
    if (props && Object.prototype.hasOwnProperty.call(props, key)) {
      const sym = extractSoilSymbolFromString(props[key]);
      if (sym) return sym;
    }
  }
  // quét toàn bộ
  for (const [k, v] of Object.entries(props || {})) {
    const sym = extractSoilSymbolFromString(v);
    if (sym) return sym;
  }
  return null;
}

// thử load ảnh theo danh sách đuôi, nếu fail thì thử đuôi tiếp theo
function trySetImgWithFallback(imgEl, basePathNoExt, exts, i = 0) {
  if (i >= exts.length) {
    imgEl.src = DEFAULT_SOIL_IMG;
    return;
  }
  imgEl.onerror = () => trySetImgWithFallback(imgEl, basePathNoExt, exts, i + 1);
  imgEl.src = basePathNoExt + exts[i];
}

// hàm chính: set ảnh theo ký hiệu tìm được
function setSoilProfileImage(props) {
  const imgEl = document.getElementById("sp-profile-img");
  if (!imgEl) return;

  const sym = findSoilSymbolAnywhere(props); // Ru/Fk/Dk/Fs
  if (!sym) {
    imgEl.src = DEFAULT_SOIL_IMG;
    return;
  }

  const base = SOIL_IMG_FOLDER + sym; // ví dụ: image/Ru
  trySetImgWithFallback(imgEl, base, IMG_EXTS);
}


// ==================================================
// V. UPDATE PANEL ĐẤT – CHỈ GỌI 1 DÒNG BÓN PHÂN
// ==================================================
function updateSoilPanel(props) {

  // Thuộc tính đất
  setTextById('Ten_dat',   props.Ten_dat || props.ID);
  setTextById('Kh_dat',    props.Kh_dat);
  setTextById('Text_tang_',props.Text_tang_);
  setTextById('Text_do_do',props.Text_do_do);
  setTextById('Text_tpcg', props.Text_tpcg);
  setTextById('Lv_ph',     props.Lv_ph);
  setTextById('Text_om',   props.Text_om);
  setTextById('Text_n',    props.Text_n);
  setTextById('Text_p',    props.Text_p);
  setTextById('Text_k',    props.Text_k);
  setTextById('Dien_tich', props.Dien_tich);

  // Thích nghi cây trồng
  setThichNghiById("Tn_lua",     props.Tn_lua);
  setThichNghiById("Tn_mia",     props.Tn_mia);
  setThichNghiById("Tn_bap",     props.Tn_bap);
  setThichNghiById("Tn_rau",     props.Tn_rau);
  setThichNghiById("Tn_caphe",   props.Tn_caphe);
  setThichNghiById("Tn_saurien", props.Tn_saurien);
  setThichNghiById("Tn_hotieu",  props.Tn_hotieu);
  setThichNghiById("Tn_maca",    props.Tn_maca);
  setThichNghiById("Tn_caosu",   props.Tn_caosu);

  // ✅ BÓN PHÂN THEO ĐỘ PHÌ + THÍCH NGHI
  updateFertilizerByFertility(props);
}
