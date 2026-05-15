let deviceToken = localStorage.getItem('deviceToken') || '';
let currentTicketId = ''; 

// КООРДИНАТЫ: Ладышев көчөсү, 25/2, Кемин
const TARGET_LAT = 42.783704;
const TARGET_LON = 75.753442;
const ALLOWED_RADIUS = 1000; // Радиус в метрах

window.onload = async function() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    if (deviceToken) {
        checkCurrentTicket();
    }
}

function updateDateTime() {
    const now = new Date();
    const options = { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    };
    document.getElementById('date-time').innerText = now.toLocaleString('ru-RU', options);
}

// ГЛАВНАЯ ФУНКЦИЯ С ПРОВЕРКОЙ GPS
async function getTicket() {
    if (!navigator.geolocation) {
        return alert("Ваш браузер не поддерживает GPS. Невозможно проверить ваше местоположение.");
    }

    // Запрашиваем координаты у пользователя
    navigator.geolocation.getCurrentPosition(async (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        // Считаем расстояние до Кемина
        const distance = calculateDistance(userLat, userLon, TARGET_LAT, TARGET_LON);

        if (distance > ALLOWED_RADIUS) {
            return alert(`ummot.kg: Вы слишком далеко (${Math.round(distance)}м). Чтобы занять очередь, нужно быть ближе 500м к зданию.`);
        }

        // Если мы рядом — отправляем запрос на сервер
        const category = document.getElementById('category').value;
        const groupSize = document.getElementById('groupSize').value;

        const response = await fetch('/api/get-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceToken, category, groupSize })
        });

        const data = await response.json();
        if (response.status !== 200) { alert(data.error); return; }

        localStorage.setItem('deviceToken', data.deviceToken);
        deviceToken = data.deviceToken;
        currentTicketId = data.ticket.id;
        showTicket(data.ticket);

    }, (error) => {
        alert("ummot.kg: Пожалуйста, разрешите доступ к местоположению в настройках браузера, чтобы получить талон.");
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

// ОСТАЛЬНЫЕ ФУНКЦИИ (ПОКАЗ ТАЛОНА И ТЕСТЫ)
function showTicket(ticket) {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('ticket-screen').classList.remove('hidden');
    document.getElementById('ticket-number').innerText = ticket.number;
    document.getElementById('ticket-count').innerText = "Людей в группе: " + ticket.groupSize;
    document.getElementById('ticket-status').innerText = ticket.status;
    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), {
        text: ticket.id, width: 150, height: 150
    });
}

async function checkCurrentTicket() {
    const response = await fetch('/api/get-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken })
    });
    const data = await response.json();
    if (data.ticket) {
        currentTicketId = data.ticket.id;
        showTicket(data.ticket);
    } else {
        localStorage.removeItem('deviceToken');
    }
}

async function simulateSecurity() {
    if (!currentTicketId) return alert("Сначала создайте талон!");
    const response = await fetch('/api/security/verify-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: currentTicketId })
    });
    const data = await response.json();
    alert(data.message || data.error);
    checkCurrentTicket(); 
}

async function simulateDoctor() {
    if (!currentTicketId) return;
    const response = await fetch('/api/doctor-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: currentTicketId })
    });
    alert("ummot.kg: Прием завершен!");
    localStorage.removeItem('deviceToken');
    location.reload(); 
}