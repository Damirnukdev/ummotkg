const TARGET_LAT = 42.783704;
const TARGET_LON = 75.753442;
const ALLOWED_RADIUS = 5000; // Увеличили до 5км для теста

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

// Эта функция сработает ПРИНУДИТЕЛЬНО при клике
document.addEventListener('click', async function(e) {
    if (e.target && e.target.id === 'ticketBtn') {
        console.log("Клик зафиксирован!");
        
        if (!navigator.geolocation) {
            alert("Включите GPS в браузере");
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const distance = getDistance(position.coords.latitude, position.coords.longitude, TARGET_LAT, TARGET_LON);

            if (distance > ALLOWED_RADIUS) {
                alert("Вы слишком далеко: " + Math.round(distance) + "м.");
                return;
            }

            const category = document.getElementById('category').value;
            const count = document.getElementById('count').value;

            const response = await fetch('/api/get-ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, count })
            });

            const data = await response.json();
            if (data.success) {
                alert("Ваш номер: " + data.ticketNumber);
            } else {
                alert("Ошибка: " + data.error);
            }
        }, (err) => {
            alert("Нужно разрешить доступ к GPS!");
        });
    }
});