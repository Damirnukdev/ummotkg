const express = require('express');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());

// Говорим серверу, где лежат наши HTML и CSS файлы
app.use(express.static(path.join(__dirname, 'public')));

const db = redis.createClient();
db.connect().then(() => console.log('База данных Redis подключена.'));

const MAX_LIMIT = 999;

// Инициализация настроек очереди
// Инициализация настроек очереди (ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ)
async function initSystemConfig() {
    await db.hSet('system:config', {
        status: 'OPEN',       // Жестко ставим статус ОТКРЫТО для тестов
        timeStart: '06:00',   
        timeEnd: '09:00',     
        workDays: '1,2,3,4,5' 
    });
    console.log('Настройки очереди принудительно обновлены в БД.');
}
initSystemConfig();

// Проверка доступности очереди
async function checkQueueAvailability() {
    const config = await db.hGetAll('system:config');
    if (config.status === 'CLOSED') return { available: false, reason: 'Регистрация закрыта охраной.' };
    if (config.status === 'OPEN') return { available: true };
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    if (currentTime < config.timeStart || currentTime > config.timeEnd) {
        return { available: false, reason: `Регистрация работает с ${config.timeStart} до ${config.timeEnd}.` };
    }
    return { available: true };
}

// ЭТОТ МАРШРУТ ОТДАЕТ ИНТЕРФЕЙС ПАЦИЕНТА ПРИ ПОД КЛЮЧЕНИИ К САЙТУ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ПАЦИЕНТ ПОЛУЧАЕТ ТАЛОН
app.post('/api/get-ticket', async (req, res) => {
    const isAllowed = await checkQueueAvailability();
    if (!isAllowed.available) return res.status(403).json({ error: isAllowed.reason });

    const { deviceToken, category, groupSize } = req.body;

    if (deviceToken) {
        const existingTicket = await db.get(`device:${deviceToken}`);
        if (existingTicket) {
            const ticketData = await db.hGetAll(`ticket:${existingTicket}`);
            return res.json({ message: 'Восстановлено', ticket: ticketData });
        }
    }

    const prefix = category === 'DCP' ? 'С' : 'А';
    let ticketNumber = await db.incr(`counter:${prefix}`);

    if (ticketNumber > MAX_LIMIT) return res.status(400).json({ error: 'Лимит 999 исчерпан' });

    const formattedNumber = `${prefix}-${String(ticketNumber).padStart(3, '0')}`;
    const newToken = deviceToken || uuidv4();
    const ticketId = uuidv4();

    const ticketInfo = {
        id: ticketId, number: formattedNumber, category, groupSize: String(groupSize), status: 'CREATED'
    };

    await db.hSet(`ticket:${ticketId}`, ticketInfo);
    await db.set(`device:${newToken}`, ticketId);

    res.json({ deviceToken: newToken, ticket: ticketInfo });
});

// ОХРАНА ПРОПУСКАЕТ ПАЦИЕНТА
app.post('/api/security/verify-patient', async (req, res) => {
    const { ticketId } = req.body;
    const ticketKey = `ticket:${ticketId}`;
    if (!(await db.exists(ticketKey))) return res.status(404).json({ error: 'Не найден' });

    const ticketData = await db.hGetAll(ticketKey);
    if (ticketData.status !== 'CREATED') return res.status(400).json({ error: 'Уже использован' });

    await db.hSet(ticketKey, 'status', 'IN_QUEUE');
    await db.sAdd(`pool:${ticketData.category === 'DCP' ? 'С' : 'А'}`, ticketId);

    res.json({ message: 'Турникет открыт', ticketNumber: ticketData.number });
});

// ОПЕРАТОР В ОКНЕ ВЫЗЫВАЕТ СЛЕДУЮЩЕГО (РАНДОМ)
app.post('/api/next-patient', async (req, res) => {
    let ticketId = await db.sPop('pool:С'); 
    if (!ticketId) ticketId = await db.sPop('pool:А'); 
    if (!ticketId) return res.json({ message: 'Очередь пуста.' });

    await db.hSet(`ticket:${ticketId}`, 'status', 'AT_WINDOW');
    res.json({ ticket: await db.hGetAll(`ticket:${ticketId}`) });
});

// ВРАЧ ПОДТВЕРЖДАЕТ ПРИЕМ (ТАЛОН ИСЧЕЗАЕТ)
app.post('/api/doctor-confirm', async (req, res) => {
    const { ticketId } = req.body;
    const ticketKey = `ticket:${ticketId}`;
    if (!(await db.exists(ticketKey))) return res.status(404).json({ error: 'Не найден' });

    const keys = await db.keys('device:*');
    for (let key of keys) {
        if ((await db.get(key)) === ticketId) { await db.del(key); break; }
    }
    await db.del(ticketKey); 
    res.json({ message: 'Прием завершен' });
});

app.listen(3000, () => console.log('Сервер работает на порту 3000.'));