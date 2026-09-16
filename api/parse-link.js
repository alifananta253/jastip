const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors')({ origin: true });

export default async function handler(req, res) {
    return new Promise((resolve, reject) => {
        cors(req, res, async () => {
            if (req.method === 'GET' && req.query.action === 'rates') {
                try {
                    // Mengambil data kurs dengan basis USD agar presisi tinggi
                    let currencyRes = await axios.get('https://open.er-api.com/v6/latest/USD');
                    if (currencyRes.data && currencyRes.data.rates) {
                        let ratesFromUSD = currencyRes.data.rates;
                        let idrRatePerUSD = ratesFromUSD.IDR || 17688;
                        let convertedRates = {};
                        
                        // Menghitung kurs silang mata uang asing ke IDR berdasarkan basis USD
                        for (let curr in ratesFromUSD) {
                            if (curr === 'USD') {
                                convertedRates['USD'] = Math.round(idrRatePerUSD * 1000) / 1000;
                            } else {
                                let rateToIDR = idrRatePerUSD / ratesFromUSD[curr];
                                convertedRates[curr] = Math.round(rateToIDR * 1000) / 1000;
                            }
                        }
                        
                        // Memastikan IDR bernilai tetap 1 ke 1
                        convertedRates['IDR'] = 1;

                        res.status(200).json({ success: true, rates: convertedRates });
                        return resolve();
                    }
                } catch (err) {
                    res.status(500).json({ error: 'Gagal memuat kurs real-time.' });
                    return resolve();
                }
            }

            if (req.method !== 'POST') {
                res.status(405).json({ error: 'Method not allowed' });
                return resolve();
            }

            const { url } = req.body;
            if (!url) {
                res.status(400).json({ error: 'URL tidak boleh kosong!' });
                return resolve();
            }

            try {
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*$q=0.8'
                    }
                });

                const $ = cheerio.load(response.data);
                let price = 0;
                let currency = 'USD';

                let rawPriceText = '';
                if ($('.apexPriceToPay .a-offscreen').length > 0) {
                    rawPriceText = $('.apexPriceToPay .a-offscreen').first().text();
                } else if ($('#corePrice_feature_div .a-price .a-offscreen').length > 0) {
                    rawPriceText = $('#corePrice_feature_div .a-price .a-offscreen').first().text();
                } else if ($('.priceToPay .a-offscreen').length > 0) {
                    rawPriceText = $('.priceToPay .a-offscreen').first().text();
                } else if ($('.a-price .a-offscreen').length > 0) {
                    rawPriceText = $('.a-price .a-offscreen').first().text();
                }

                let cleanNumber = rawPriceText.replace(/[^0-9.]/g, '');
                price = parseFloat(cleanNumber) || 0;

                if (url.includes('amazon.co.jp') || rawPriceText.includes('JPY') || rawPriceText.includes('¥')) {
                    currency = 'JPY';
                } else if (url.includes('amazon.sg') || rawPriceText.includes('S$')) {
                    currency = 'SGD';
                } else {
                    currency = 'USD';
                }

                if (price <= 0) {
                    res.status(400).json({ error: 'Gagal mendeteksi harga otomatis. Silakan gunakan input manual.' });
                    return resolve();
                }

                res.status(200).json({ success: true, currency, price });
                return resolve();

            } catch (error) {
                res.status(500).json({ error: 'Gagal mengambil data dari link tersebut.' });
                return resolve();
            }
        });
    });
}
