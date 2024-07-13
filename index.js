const WebSocket = require('ws');
const axios = require('axios');
const tough = require('tough-cookie');
const {wrapper} = require('axios-cookiejar-support');
const fs = require('fs');
const express = require('express');
const {Server} = require('ws');
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.static('public'));

const TelegramBot = require('node-telegram-bot-api');
const token = '7318161009:AAEZPx2RIBXhDWgHUIAlzJFAvyj6ia45yRw';
const telegramBot = new TelegramBot(token);
const chatId = '1958068409';

async function sendTelegramMessage(message) {
    try {
        await telegramBot.sendMessage(chatId, message);
    } catch (error) {
        console.error("Lỗi gửi tin nhắn đến Telegram:", error);
    }
}

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
const wss = new Server({server});
let validDataList = [];
let checkAllGiftStatus = '';
wss.on('connection', (ws) => {
    console.log('Client connected');

    if (validDataList.length > 0) {
        ws.send(JSON.stringify({type: 'validDataList', data: validDataList}));
    }
    if (checkAllGiftStatus) {
        ws.send(JSON.stringify({type: 'status', data: checkAllGiftStatus}));
    }

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

async function delay(minSeconds, maxSeconds) {
    const randomDelay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) * 1000) + (minSeconds * 1000);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    return randomDelay / 1000;
}

async function authLogin(token, retries = 3) {
    if (retries < 0) {
        return null;
    } else if (retries < 2) {
        // Đợi 1s đến 3s
        await delay(1, 3);
    }
    try {
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({jar}));
        const urlLogin = `https://var.fconline.garena.vn/auth/login/callback?access_token=${token}`;
        await client.get(urlLogin, {
            headers: {
                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document',
                'host': 'var.fconline.garena.vn'
            }
        });
        const cookies = await jar.getCookies(urlLogin);
        const sessionCookie = cookies.find(cookie => cookie.key === 'session');
        const sessionSigCookie = cookies.find(cookie => cookie.key === 'session.sig');
        if (sessionCookie && sessionSigCookie) {
            const session = sessionCookie.value;
            const sessionSig = sessionSigCookie.value;
            const cookieString = `session=${session}; session.sig=${sessionSig}`;
            return cookieString;
        } else {
            console.log("Session cookies not found");
        }
    } catch (error) {
        console.error("Lỗi xác thực:", error);
        return await authLogin(token, retries - 1);
    }
}

async function getInfo(cookie, retries = 3) {
    if (retries < 0) {
        return null;
    } else if (retries < 3) {
        // Đợi 1s đến 3s
        await delay(1, 3);
    }
    try {
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({jar}));
        const urlGetPlayer = "https://var.fconline.garena.vn/api/player/get";
        const response = await client.get(urlGetPlayer, {
            headers: {
                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'Accept': 'application/json, text/plain, */*',
                'sec-ch-ua-mobile': '?0',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'sec-ch-ua-platform': '"Windows"',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'host': 'var.fconline.garena.vn',
                'Cookie': cookie
            }
        });
        return response.data;
    } catch (error) {
        console.error("Lỗi lấy thông tin người chơi", error);
        return await getInfo(cookie, retries - 1);
    }
}

async function exchangeVoucher(cookie, id, retries = 15) {
    if (retries < 0) {
        return null;
    } else if (retries < 15) {
        await delay(1, 3);
    }
    try {
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({jar}));
        const urlExchange = "https://var.fconline.garena.vn/api/shop-rewards/exchange";
        const data = {id: id};
        const response = await client.post(urlExchange, data, {
            headers: {
                'Host': 'var.fconline.garena.vn',
                'Accept': 'application/json, text/plain, */*',
                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Cookie': cookie
            }
        });
        return response.data;
    } catch (error) {
        console.error("Thực hiện lấy voucher không thành công!", error.response.status);
        return exchangeVoucher(cookie, id, retries - 1);
    }
}

async function readTokensFromFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            const tokens = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            resolve(tokens);
        });
    });
}

async function rewardHistory(cookie) {
    if (cookie) {
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({jar}));
        const urlHistory = "https://var.fconline.garena.vn/api/player/reward-history";
        const response = await client.get(urlHistory, {
            headers: {
                'sec-ch-ua': 'Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24',
                'Accept': 'application/json, text/plain, */*',
                'sec-ch-ua-mobile': '?0',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'sec-ch-ua-platform': 'Windows',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'host': 'var.fconline.garena.vn',
                'Cookie': cookie
            }
        });
        return response.data;
    }
    return null;

}

async function checkVoucher(token) {
    const cookie = await authLogin(token);
    const id100 = 12;
    const id50 = 13;
    if (cookie) {
        const history = await rewardHistory(cookie);
        if (history) {
            const hasVoucherShopee50k = history.userRewardList.some(item => item.name.includes("Voucher Shopee 50k"));
            const hasVoucherShopee100k = history.userRewardList.some(item => item.name.includes("Voucher Shopee 100k"));
            if (hasVoucherShopee50k) {
                return {
                    token: token,
                    cookie: cookie,
                    exchangerId: id100
                };
            } else if (hasVoucherShopee100k) {
                return {
                    token: token,
                    cookie: cookie,
                    exchangerId: id50
                };
            } else {
                return {
                    token: token,
                    cookie: cookie,
                    exchangerId: id100
                };
            }

        } else {
            console.log("Chưa có lích sử tích điểm");
            return {
                token: token,
                cookie: cookie,
                exchangerId: id100
            };
        }
    }
    return null;
}

async function prepareData() {
    console.time('prepareData');
    const listTokens = await readTokensFromFile('data.txt');
    const listTokensNew = Array(2).fill(listTokens).flat();
    const dataExchanger = [];
    for (const token of listTokensNew) {
        const response = await checkVoucher(token);
        if (response) {
            dataExchanger.push(response);
        }
    }
    console.timeEnd('prepareData');
    return dataExchanger;
}

async function checkAllGift() {
    try {
        const url = "https://var.fconline.garena.vn/api/shop-rewards";
        const response = await axios.get(url, {
            headers: {
                "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
                Accept: "application/json, text/plain, */*",
                "sec-ch-ua-mobile": "?0",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "sec-ch-ua-platform": '"Windows"',
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                host: "var.fconline.garena.vn",
            },
        });

        const rewards = response.data.userShopRewards;
        const selectedRewards = rewards.filter(
            (reward) => reward.shopReward.id >= 8 && reward.shopReward.id <= 13,
        );

        const allUserExchanger8 = 50;
        const allUserExchanger9 = 100;
        const allUserExchanger10 = 30;
        const allUserExchanger11 = 120;
        const allUserExchanger12 = 280;
        const allUserExchanger13 = 200;
        const item8 = selectedRewards.find((item) => item.shopReward.id === 8);
        const item9 = selectedRewards.find((item) => item.shopReward.id === 9);
        const item10 = selectedRewards.find((item) => item.shopReward.id === 10);
        const item11 = selectedRewards.find((item) => item.shopReward.id === 11);
        const item12 = selectedRewards.find((item) => item.shopReward.id === 12);
        const item13 = selectedRewards.find((item) => item.shopReward.id === 13);
        if (
            allUserExchanger8 !== item8.allUserExchanged ||
            allUserExchanger9 !== item9.allUserExchanged ||
            allUserExchanger10 !== item10.allUserExchanged ||
            allUserExchanger11 !== item11.allUserExchanged ||
            allUserExchanger12 !== item12.allUserExchanged ||
            allUserExchanger13 !== item13.allUserExchanged ||
            item8.allUserExchangedPerWeek !== item8.shopReward.limitForAllUserPerWeek ||
            item9.allUserExchangedPerWeek !== item9.shopReward.limitForAllUserPerWeek ||
            item10.allUserExchangedPerWeek !== item10.shopReward.limitForAllUserPerWeek ||
            item11.allUserExchangedPerWeek !== item11.shopReward.limitForAllUserPerWeek ||
            item12.allUserExchangedPerWeek !== item12.shopReward.limitForAllUserPerWeek ||
            item13.allUserExchangedPerWeek !== item13.shopReward.limitForAllUserPerWeek
        ) {
            const message = "Bắt đầu trao đổi voucher...";
            console.log(message);
            broadcast({type: 'status', data: message});
            await sendTelegramMessage(message);
            return true;
        } else {
            const randomNum = Math.floor(Math.random() * 1000);
            const message = `Chưa có sự thay đổi về số lượng quà ${randomNum}`;
            console.log(message);
            broadcast({type: 'status', data: message});
            return await checkAllGift();
        }
    } catch (error) {
        const message = `Lỗi check gift: ${error.message}`;
        console.error(message);
        broadcast({type: 'status', data: message});
        await sendTelegramMessage(message);
        return await checkAllGift();
    }
}


async function processGifts() {
    try {
        const validDataList = await prepareData();
        if (validDataList.length > 0) {
            console.log("Dữ liệu đã sẵn sàng", validDataList.length);
            broadcast({type: 'Dữ liệu đã thực thi', data: validDataList.length});
            await sendTelegramMessage(validDataList.length);
        } else {
            console.log("Không có dữ liệu hợp lệ.");
            broadcast({type: 'status', data: "Không có dữ liệu hợp lệ."});
        }

        const status = await checkAllGift();
        if (status) {
            const exchangePromises = validDataList.map(data => {
                return exchangeVoucher(data.cookie, data.exchangerId).then(async result => {
                    const message = `Token: ${data.token}, Point: ${data.point}, ID: ${data.exchangerId}, Result: ${JSON.stringify(result)}`;
                    console.log(message);
                    broadcast({
                        type: 'exchangeResult',
                        data: {token: data.token, point: data.point, id: data.exchangerId, result}
                    });
                    await sendTelegramMessage(message);
                });
            });
            await Promise.all(exchangePromises);
        }
    } catch (error) {
        const message = `Lỗi trong quá trình xử lý quà: ${error.message}`;
        console.error(message);
        await sendTelegramMessage(message);
        broadcast({type: 'status', data: message});
    }
}

processGifts().catch((error) => {
    const message = `Lỗi trong lần chạy đầu tiên: ${error.message}`;
    console.error(message);
    broadcast({type: 'status', data: message});
});


app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Voucher Exchange Status</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                }
                #validDataList, #status {
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <h1>Voucher Exchange Status</h1>
            <div id="status"></div>
            <div id="validDataList"></div>
            <div id="totalDataCount"></div>

            <script>
                const ws = new WebSocket('ws://' + location.host);

                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log(message)
                    if (message.type === 'validDataList') {
                        const validDataListElement = document.getElementById('validDataList');
                        validDataListElement.innerHTML = '<h2>Valid Data List</h2>';
                        message.data.forEach(item => {
                            const div = document.createElement('div');
                            div.textContent = \`Token: \${item.token}, Cookie: \${item.cookie}, ExchangerId: \${item.exchangerId}\`;
                            validDataListElement.appendChild(div);
                        });
                    } else if (message.type === 'status') {
                        const statusElement = document.getElementById('status');
                        const div = document.createElement('div');
                        div.textContent = message.data;
                        statusElement.appendChild(div);
                    } else if (message.type === 'exchangeResult') {
                        const statusElement = document.getElementById('status');
                        const div = document.createElement('div');
                        div.textContent = \`Token: \${message.data.token}, Point: \${message.data.point}, ID: \${message.data.id}, Result: \${JSON.stringify(message.data.result)}\`;
                        statusElement.appendChild(div);
                    }
                };

                ws.onopen = () => {
                    console.log('WebSocket connected');
                };

                ws.onclose = () => {
                    console.log('WebSocket disconnected');
                };
            </script>
        </body>
        </html>
    `);
});

