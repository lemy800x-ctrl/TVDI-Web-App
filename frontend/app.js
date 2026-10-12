// 1. Khởi tạo Bản đồ WebGIS tại TP.HCM
const map = L.map('map').setView([10.7769, 106.7009], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 2. Tạo Chú giải Thang màu chuẩn TVDI[cite: 6]
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = `
        <strong>Thang màu TVDI (Độ khô hạn)</strong><br>
        <div class="legend-gradient" style="background: linear-gradient(to right, #066b00, #00ff00, #ffff00, #ff6600, #ff0000);"></div>
        <small>0.0 (Ẩm) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 1.0 (Khô hạn)</small>
    `;
    return div;
};
legend.addTo(map);

// Marker vị trí dự báo trên bản đồ
let currentMarker = L.marker([10.7769, 106.7009]).addTo(map);

// 3. Khởi tạo các Biểu đồ Dashboard (Chart.js)[cite: 7]
const ctxLine = document.getElementById('lineChart').getContext('2d');
const lineChart = new Chart(ctxLine, {
    type: 'line',
    data: {
        labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
        datasets: [{
            label: 'Diễn biến TVDI Mùa vụ',
            data: [0.42, 0.55, 0.72, 0.81, 0.65, 0.40, 0.35, 0.38, 0.45, 0.50, 0.48, 0.41],
            borderColor: '#ff6600',
            backgroundColor: 'rgba(255, 102, 0, 0.1)',
            fill: true,
            tension: 0.3
        }]
    },
    options: { responsive: true, maintainAspectRatio: false }
});

const ctxBar = document.getElementById('barChart').getContext('2d');
const barChart = new Chart(ctxBar, {
    type: 'bar',
    data: {
        labels: ['TP.HCM cũ', 'Bình Dương', 'Bà Rịa - Vũng Tàu'],
        datasets: [{
            label: 'LST (°C)',
            data: [36.5, 35.2, 32.8],
            backgroundColor: '#3b82f6'
        }, {
            label: 'NDVI (x100)',
            data: [30, 45, 60],
            backgroundColor: '#22c55e'
        }]
    },
    options: { responsive: true, maintainAspectRatio: false }
});

// 4. Hàm Gọi API Dự báo AI
async function predictTVDI() {
    const ndvi = parseFloat(document.getElementById('input-ndvi').value);
    const lst = parseFloat(document.getElementById('input-lst').value);
    const month = parseInt(document.getElementById('input-month').value);

    // URL Backend API (Nếu deploy Render thì thay bằng URL của Render)
    const API_URL = 'http://127.0.0.1:8000/api/predict-tvdi';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ndvi, lst, month })
        });
        
        if (!response.ok) throw new Error("Lỗi API Server");
        
        const data = await response.json();

        // Cập nhật kết quả lên UI
        document.getElementById('tvdi-value').innerText = data.predicted_tvdi;
        const badge = document.getElementById('drought-badge');
        badge.innerText = data.drought_status;
        badge.style.background = data.color_code;
        if(data.color_code === "#ffff00") badge.style.color = "#000"; else badge.style.color = "#fff";

        // Cập nhật Marker lên bản đồ
        currentMarker.bindPopup(`<b>Dự báo TVDI: ${data.predicted_tvdi}</b><br>Trạng thái: ${data.drought_status}`).openPopup();

    } catch (err) {
        alert("Chưa kết nối được Backend FastAPI. Hãy chắc chắn bạn đã chạy lệnh `uvicorn main:app`!");
    }
}
