// =========================
// 1. KHỞI TẠO BẢN ĐỒ MAPBOX
// =========================

// Token Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoiYmluaDg2IiwiYSI6ImNtNWtma2I3azBqOTIybHNmcDNldWQ3dTkifQ.obH8v6Lfuy8tfVeZmfBGcA';

// Tạo bản đồ nền
const map = new mapboxgl.Map({
    container: 'map', // id của <div> trong HTML
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    projection: 'globe',
    zoom: 8,
    center: [108.11424446587102, 12.880850957736499]
});

const DEFAULT_ZOOM = 5; // chỉnh 13, 15 tùy anh

// =========================
// 2. ĐỊNH VỊ GPS + POPUP VỊ TRÍ
// =========================

// Tạo control định vị
const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: false, // không bám theo liên tục
    showUserHeading: false
});

let userPopup = null; // Quản lý popup vị trí người dùng


// Sự kiện khi định vị được
geolocate.on('geolocate', function (e) {
    const userCoords = [e.coords.longitude, e.coords.latitude];
    const lngLat = { lng: userCoords[0], lat: userCoords[1] };

    // 1. Bay đến vị trí GPS (zoom giống khi click)
    map.flyTo({
        center: lngLat,
        zoom: Math.max(map.getZoom(), 13),
        duration: 800
    });

    // 2. Giả lập một sự kiện click tại đúng vị trí GPS
    //    để dùng lại toàn bộ logic trong map.on("click", ...)
    const point = map.project(lngLat);

    map.fire('click', {
        lngLat: lngLat,
        point: point
    });
});


// Khi bản đồ tải xong
map.on('load', function () {
    // Thêm điều khiển zoom, xoay
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Thêm điều khiển định vị GPS
    map.addControl(geolocate, 'top-right');

    // Tự động kích hoạt định vị một lần khi load
    geolocate.trigger();
});


// =========================
// 3. ẨN/HIỆN DANH SÁCH TỈNH – HUYỆN (SIDEBAR)
// =========================

// Toggle danh sách tỉnh Tây Nguyên
function toggletaynguyenList(id) {
    document.querySelectorAll(".tinh-list").forEach(menu => {
        if (menu.id !== id) {
            menu.style.display = "none";
        }
    });

    const tinhList = document.getElementById(id);
    if (tinhList) {
        tinhList.style.display = (tinhList.style.display === "block") ? "none" : "block";
    }
}

// Toggle danh sách huyện Đắk Lắk
function toggledaklakList(id) {
    document.querySelectorAll(".huyen-list").forEach(menu => {
        if (menu.id !== id) {
            menu.style.display = "none";
        }
    });

    const huyenList = document.getElementById(id);
    if (huyenList) {
        huyenList.style.display = (huyenList.style.display === "block") ? "none" : "block";
    }
}

// Ẩn tất cả menu khi click ra ngoài sidebar
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

// Map tên huyện -> màu tô
const colorMap = {
    'krongpak': '#FF5733',
    'eakar': '#84193B'
};

// Lưu id của polygon đang được highlight
let hoveredFeatureId = null;


// =========================
// 4B. MARKER KHI CLICK
// =========================

// Một marker dùng chung cho tất cả lần click
let clickMarker = null;

// Đặt/move marker tại vị trí click
function setClickMarker(lngLat) {
    if (!clickMarker) {
        clickMarker = new mapboxgl.Marker({
            anchor: 'bottom' // chân marker chạm đúng vị trí đất
        })
            .setLngLat(lngLat)
            .addTo(map);
    } else {
        clickMarker.setLngLat(lngLat);
    }
}

// Zoom sao cho marker nằm giữa bản đồ, phía trên panel đất
// Zoom sao cho marker nằm giữa bản đồ, hơi phía trên panel đất
function centerMapWithPanel(lngLat, showPanel) {
    // Mặc định: nếu không cần canh theo panel thì cứ bay thẳng tới điểm click
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

    // Vị trí marker hiện tại trên màn hình (trước khi bay)
    const markerPoint = map.project(lngLat);

    // TỌA ĐỘ MONG MUỐN CỦA MARKER TRÊN MÀN HÌNH:
    //  - Nằm giữa ngang (x = giữa bản đồ)
    //  - Cao hơn panel một chút: lấy khoảng 35% chiều cao màn hình
    const targetX = mapWidth / 2;
    const targetY = mapHeight * 0.3; // muốn cao nữa thì giảm 0.35 -> 0.3, muốn thấp thì tăng lên

    // Độ lệch cần dịch marker trên màn hình
    const dx = targetX - markerPoint.x;
    const dy = targetY - markerPoint.y;

    // Tâm bản đồ hiện tại
    const centerPoint = map.project(map.getCenter());

    // Để marker dịch sang phải +dx trên màn hình -> phải kéo tâm sang trái -dx
    // Tương tự với trục Y
    centerPoint.x -= dx;
    centerPoint.y -= dy;

    // Tâm mới tương ứng với vị trí marker mong muốn
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
            const selectedHuyen = this.value;              // ví dụ: "krongpak"
            const sourceId = selectedHuyen.toLowerCase();  // "krongpak"
            const layerId = sourceId + "-layer";           // "krongpak-layer"
            const geojsonFile = sourceId + ".geojson";     // "krongpak.geojson"

            // Nếu đang theo dõi vị trí (theo kiểu nội bộ của Mapbox) thì dừng
            if (geolocate._watchState === "ACTIVE_LOCK") {
                geolocate._clearWatch();  // API nội bộ, có thể thay đổi ở phiên bản khác
            }

            // Xóa tất cả source & layer cũ của các huyện
            huyenRadios.forEach(r => {
                const oldSourceId = r.value.toLowerCase();
                const oldLayerId = oldSourceId + "-layer";

                if (map.getLayer(oldLayerId)) {
                    map.removeLayer(oldLayerId);
                }
                if (map.getSource(oldSourceId)) {
                    map.removeSource(oldSourceId);
                }
            });

            // Tải file GeoJSON tương ứng với huyện được chọn
            fetch(geojsonFile)
                .then(response => response.json())
                .then(data => {
                    // Thêm source: generateId để Mapbox tự gán id cho từng polygon
                    map.addSource(sourceId, {
                        type: "geojson",
                        data: data,
                        generateId: true
                    });

                    // Thêm layer tô màu polygon, dùng feature-state để làm hiệu ứng hover/highlight
                    map.addLayer({
                        id: layerId,
                        type: "fill",
                        source: sourceId,
                        paint: {
                            "fill-color": colorMap[selectedHuyen] || "#FFFFFF",
                            "fill-opacity": [
                                'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                0.6,   // khi được highlight
                                0.2    // bình thường
                            ],
                            "fill-outline-color": "#000000"
                        }
                    });

                    // Zoom về huyện theo tâm (center) và mức zoom (zoom) trong thuộc tính GeoJSON
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

// Trượt panel lên (hiện)
function slidePanelUp() {
    if (!soilPanel) return;
    soilPanel.classList.add('panel-open');
    soilPanel.classList.remove('panel-closed', 'hidden');
    isPanelOpen = true;
}

// Trượt panel xuống (ẩn). Có callback nếu cần làm gì sau khi ẩn xong
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
    // 1. Lấy danh sách các layer huyện đang tồn tại trên bản đồ
    const visibleHuyenLayers = Object.keys(colorMap)
        .map(h => h + "-layer")
        .filter(id => map.getLayer(id)); // chỉ giữ lại layer đã add

    // 2. Kiểm tra xem click có trúng polygon huyện nào không
    const features = visibleHuyenLayers.length > 0
        ? map.queryRenderedFeatures(e.point, { layers: visibleHuyenLayers })
        : [];

    // =========================
    // TRƯỜNG HỢP CLICK TRÚNG POLYGON
    // =========================
    if (features.length > 0) {
        const feature = features[0];
        const props = feature.properties;

        // Đặt/move marker tại vị trí click
        setClickMarker(e.lngLat);
        // Canh tâm bản đồ sao cho marker nằm phía trên panel
        centerMapWithPanel(e.lngLat, true);

        // Xử lý highlight: tắt highlight cũ, bật highlight mới
        if (hoveredFeatureId !== null) {
            Object.keys(colorMap).forEach(h => {
                const srcId = h.toLowerCase();
                if (map.getSource(srcId)) {
                    map.setFeatureState(
                        { source: srcId, id: hoveredFeatureId },
                        { hover: false }
                    );
                }
            });
        }

        hoveredFeatureId = feature.id;
        const currentSourceId = feature.source;
        if (currentSourceId) {
            map.setFeatureState(
                { source: currentSourceId, id: hoveredFeatureId },
                { hover: true }
            );
        }

        // Panel đang mở: hạ xuống rồi đổ dữ liệu mới và kéo lên lại
        if (isPanelOpen) {
            slidePanelDown(() => {
                updateSoilPanel(props);
                slidePanelUp();
            });
        } else {
            // Panel đang đóng: đổ dữ liệu và kéo lên
            updateSoilPanel(props);
            slidePanelUp();
        }

    } else {
        // =========================
        // TRƯỜNG HỢP CHƯA CÓ LAYER HUYỆN HOẶC CLICK RA NGOÀI POLYGON
        // =========================

        // Đặt/move marker tại vị trí click (vẫn cho user biết mình vừa click đâu)
        setClickMarker(e.lngLat);
        // Không cần dời tâm theo panel (panel đang hạ xuống)
        centerMapWithPanel(e.lngLat, false);

        // Tắt highlight nếu đang có
        if (hoveredFeatureId !== null) {
            Object.keys(colorMap).forEach(h => {
                const srcId = h.toLowerCase();
                if (map.getSource(srcId)) {
                    map.setFeatureState(
                        { source: srcId, id: hoveredFeatureId },
                        { hover: false }
                    );
                }
            });
            hoveredFeatureId = null;
        }

        // Hạ panel xuống nếu đang mở
        if (isPanelOpen) {
            slidePanelDown();
        }

        // Hiện popup tọa độ
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
                <b>Kinh độ:</b> ${e.lngLat.lng.toFixed(6)}  
                <br>
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
    // 1. Soil summary
    document.getElementById('sp-name').textContent =
        props.KH_pd || props.ID || '—';

    document.getElementById('sp-ph').textContent =
        props.pH ? `${props.pH} ${props.pH_muc || ''}` : 'Chưa có';

    document.getElementById('sp-om').textContent =
        props.Huu_co ? `${props.Huu_co} ${props.OM_muc || ''}` : 'Chưa có';

    document.getElementById('sp-cec').textContent =
        props.CEC ? `${props.CEC} ${props.CEC_muc || ''}` : 'Chưa có';

    // Ảnh phẫu diện – nếu trong GeoJSON có đường dẫn ảnh
    if (props.Profile_img) {
        document.getElementById('sp-profile-img').src = props.Profile_img;
    }

    // 2. Thông tin đất
    document.getElementById('KH_dat').textContent =
        props.KH_dat || '—';          // Ví dụ: "Ru", "Fk"

    document.getElementById('Ten_dat').textContent =
        props.Ten_dat || 'Chưa có';   // Tên đất

    document.getElementById('Tinh').textContent =
        props.Tinh || 'Chưa có';      // Tỉnh

    document.getElementById('Xa').textContent =
        props.Xa || 'Chưa có';        // Xã

    // 3. Khuyến cáo phân bón: sau này anh đổ tiếp từ props hoặc từ JSON khác
    // (hiện đang để trống)
}


// =========================
// 9. NÚT ĐÓNG PANEL
// =========================

const closeBtn = document.getElementById('panel-close-btn');

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        if (typeof slidePanelDown === "function") {
            slidePanelDown();
        } else {
            document.getElementById('soil-panel').classList.add('hidden');
        }
    });
}
