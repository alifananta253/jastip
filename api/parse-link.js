const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors')({ origin: true });

export default async function handler(req, res) {
    return new Promise((resolve, reject) => {
        cors(req, res, async () => {
            if (req.method === 'GET' && req.query.action === 'rates') {
                try {
                    let currencyRes = await axios.get('https://open.er-api.com/v6/latest/IDR');
                    if (currencyRes.data && currencyRes.data.rates) {
                        let baseRates = currencyRes.data.rates;
                        let convertedRates = {};
                        for (let curr in baseRates) {
                            convertedRates[curr] = Math.round((1 / baseRates[curr]) * 1000) / 1000;
                        }
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
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    }
                });

                const $ = cheerio.load(response.data);
                let price = 0;
                let currency = 'USD';

                // Mengambil teks harga tersembunyi yang akurat dari Amazon (.a-offscreen biasanya berisi nilai bersih misal "$19.99")
                let rawPriceText = '';
                if ($('.a-price .a-offscreen').length > 0) {
                    rawPriceText = $('.a-price .a-offscreen').first().text();
                } else if ($('#priceblock_ourprice').length > 0) {
                    rawPriceText = $('#priceblock_ourprice').text();
                }

                // Membersihkan string harga (mengambil angka dan titik saja, misal "$19.99" jadi "19.99")
                let cleanNumber = rawPriceText.replace(/[^0-9.]/g, '');
                price = parseFloat(cleanNumber) || 0;

                // Deteksi Mata Uang berdasarkan Domain atau Simbol
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
