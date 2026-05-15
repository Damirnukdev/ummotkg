// 1. Координаты и настройки
const TARGET_LAT = 42.783704;
const TARGET_LON = 75.753442;
const ALLOWED_RADIUS = 2000; // Увеличили до 2км для уверенности

// Функция расчета расстояния
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ГЛАВНАЯ ФУНКЦИЯ КНОПКИ
async function getTicket() {
    console.log("Кнопка нажата, запрашиваем геолокацию...");
    
    if (!navigator.geolocation) {
        alert("Геолокация не поддерживается вашим браузером");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const distance = getDistance(userLat, userLon, TARGET_LAT, TARGET_LON);

        if (distance > ALLOWED_RADIUS) {
            alert(`Вы слишком далеко (${Math.round(distance)}м). Нужно быть ближе ${ALLOWED_RADIUS}м.`);
            return;
        }

        const category = document.getElementById('category').value;
        const count = document.getElementById('count').value;

        try {
            const response = await fetch('/api/get-ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, count })
            });

            const data = await response.json();
            if (data.success) {
                alert(`Ваш талон: ${data.ticketNumber}\nВаше место в очереди: ${data.position}`);
                // Можно добавить редирект на страницу талона, если она есть
            } else {
                alert("Ошибка сервера: " + data.error);
            }
        } catch (error) {
            console.error("Ошибка при запросе:", error);
            alert("Не удалось связаться с сервером.");
        }
    }, (error) => {
        alert("Ошибка GPS: разрешите доступ к местоположению в браузере.");
    });
}

// Привязываем функцию к кнопке после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('button'); // Находит первую кнопку на странице
    if (btn) {
        btn.onclick = getTicket;
    }
});