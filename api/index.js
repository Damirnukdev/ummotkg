const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // 1. ПОЛУЧЕНИЕ ИЛИ ПРОВЕРКА ТАЛОНА
    if (req.url.includes('/get-ticket') && req.method === 'POST') {
        const { deviceToken, category, groupSize } = req.body;
        
        // Если пришел только токен — проверяем старый талон
        if (deviceToken && !category) {
            const ticket = await redis.get(`active:${deviceToken}`);
            return res.status(200).json({ ticket });
        }

        // Создаем новый талон
        const newToken = deviceToken || Math.random().toString(36).substr(2, 15);
        const count = await redis.incr(`count:${category}`);
        const ticketNumber = `${category}-${count.toString().padStart(3, '0')}`;
        
        const ticket = {
            id: Math.random().toString(36).substr(2, 9),
            number: ticketNumber,
            status: 'В очереди',
            groupSize
        };

        await redis.set(`active:${newToken}`, ticket, { ex: 86400 });
        await redis.set(`ticket:${ticket.id}`, ticket, { ex: 86400 });
        
        return res.status(200).json({ ticket, deviceToken: newToken });
    }

    // 2. ТЕСТОВАЯ КНОПКА: ОХРАНА
    if (req.url.includes('/security/verify-patient') && req.method === 'POST') {
        const { ticketId } = req.body;
        const ticket = await redis.get(`ticket:${ticketId}`);
        if (!ticket) return res.status(404).json({ error: 'Талон не найден' });
        
        return res.status(200).json({ message: `Охрана: Проходите, ${ticket.number}!` });
    }

    
   // 3. ТЕСТОВАЯ КНОПКА: ВРАЧ (Удаление и завершение)
    if (req.url.includes('/doctor-confirm') && req.method === 'POST') {
        const { ticketId, deviceToken } = req.body;
        
        try {
            // Удаляем талон из базы по его ID
            if (ticketId) {
                await redis.del(`ticket:${ticketId}`);
            }
            // Удаляем привязку к устройству, чтобы сессия закрылась
            if (deviceToken) {
                await redis.del(`active:${deviceToken}`);
            }
            
            return res.status(200).json({ message: 'Прием завершен, талон удален из базы.' });
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка при удалении: ' + error.message });
        }
    }

    res.status(404).json({ error: 'Путь не найден' });
};