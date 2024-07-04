const express = require("express");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const TOKEN = "6506413579:AAGZk2s-5xdgVoQD06TQiZWWC4cTSVp1tnw";
const server = express();
const bot = new TelegramBot(TOKEN, {
    polling: true
});
const port = process.env.PORT || 5000;
const gameName = "HitToothMonster";
const queries = {};

// Хранилище для реферальных данных
const referrals = {}; // { inviterId: { inviter: inviterId, invitees: [inviteeId1, inviteeId2, ...] } }
const referralCount = {}; // { inviterId: number_of_referrals }
const userNames = {}; // { userId: userName }

server.use(express.static(path.join(__dirname, 'HitToothMonsterWebBackend')));

// Команда помощи
bot.onText(/help/, (msg) => bot.sendMessage(msg.from.id, "Say /game if you want to play."));

// Команда для старта игры
bot.onText(/start|game/, (msg) => bot.sendGame(msg.from.id, gameName));

// Команда для генерации реферальной ссылки
bot.onText(/referral/, (msg) => {
    const refId = msg.from.id.toString();
    referrals[refId] = referrals[refId] || { inviter: msg.from.id, invitees: [] };
    userNames[msg.from.id] = msg.from.username || msg.from.first_name || "Unknown";
    const referralLink = `https://t.me/YOUR_BOT_USERNAME?start=ref${refId}`;
    bot.sendMessage(msg.from.id, `Invite your friends using this link: ${referralLink}`);
    bot.sendMessage(msg.from.id, `Debug: Generated referral ID: ${refId}`);
});

// Обработка команды /start с реферальным ID
bot.onText(/\/start (ref\d+)/, (msg, match) => {
    const refId = match[1].replace('ref', '');
    bot.sendMessage(msg.from.id, `Debug: Received referral ID: ${refId}`);
    if (referrals[refId]) {
        const inviterId = referrals[refId].inviter;
        bot.sendMessage(msg.from.id, `Debug: Found inviter ID: ${inviterId}`);
        if (inviterId !== msg.from.id && !referrals[refId].invitees.includes(msg.from.id)) {
            referrals[refId].invitees.push(msg.from.id);
            referralCount[inviterId] = (referralCount[inviterId] || 0) + 1;
            userNames[msg.from.id] = msg.from.username || msg.from.first_name || "Unknown";
            bot.sendMessage(inviterId, `You have a new referral: ${userNames[msg.from.id]}`);
            bot.sendMessage(msg.from.id, "Thanks for joining via a referral link!");
            bot.sendMessage(msg.from.id, `Debug: Added referral: ${userNames[msg.from.id]}`);
        } else {
            bot.sendMessage(msg.from.id, `Debug: Already referred or self-refer: ${userNames[msg.from.id]}`);
        }
    } else {
        bot.sendMessage(msg.from.id, `Debug: Referral ID not found: ${refId}`);
    }
    // Запуск игры после реферального сообщения
    bot.sendGame(msg.from.id, gameName);
});

// Команда для вывода статистики рефералов
bot.onText(/referrals/, (msg) => {
    const userId = msg.from.id.toString();
    if (referrals[userId]) {
        const inviterData = referrals[userId];
        let message = `You have referred ${inviterData.invitees.length} users:\n`;
        inviterData.invitees.forEach((inviteeId, index) => {
            const inviteeName = userNames[inviteeId] || "Unknown";
            message += `${index + 1}. ${inviteeName}\n`;
        });
        bot.sendMessage(msg.from.id, message);
    } else {
        bot.sendMessage(msg.from.id, "You have not referred any users yet.");
    }
});

// Команда для вывода таблицы лидеров
bot.onText(/leaderboard/, (msg) => {
    const sortedReferrals = Object.entries(referralCount).sort((a, b) => b[1] - a[1]);
    let message = "Referral Leaderboard:\n";
    sortedReferrals.forEach(([inviterId, count], index) => {
        const inviterName = userNames[inviterId] || "Unknown";
        message += `${index + 1}. ${inviterName} - ${count} referrals\n`;
    });
    bot.sendMessage(msg.from.id, message);
});

// Обработка callback_query для игры
bot.on("callback_query", function (query) {
    if (query.game_short_name !== gameName) {
        bot.answerCallbackQuery(query.id, "Sorry, '" + query.game_short_name + "' is not available.");
    } else {
        queries[query.id] = query;
        let gameurl = "https://yegmina.github.io/HitToothMonsterWeb/";
        bot.answerCallbackQuery({
            callback_query_id: query.id,
            url: gameurl
        });
    }
});

// Обработка inline_query для игры
bot.on("inline_query", function (iq) {
    bot.answerInlineQuery(iq.id, [{
        type: "game",
        id: "0",
        game_short_name: gameName
    }]);
});

// Установка игрового счета
server.get("/highscore/:score", function (req, res, next) {
    if (!Object.hasOwnProperty.call(queries, req.query.id)) return next();
    let query = queries[req.query.id];
    let options;
    if (query.message) {
        options = {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id
        };
    } else {
        options = {
            inline_message_id: query.inline_message_id
        };
    }
    bot.setGameScore(query.from.id, parseInt(req.params.score), options, function (err, result) {});
});

server.listen(port);
