const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors')({ origin: true });

export default async function handler(req, res) {
    return new Promise((resolve, reject) => {
        cors(req, res, async () => {
            // Endpoint tambahan untuk mengambil kurs real-time semua mata uang ke IDR
            if (req.method === 'GET' && req.query.action === 'rates') {
                try {
                    // Mengambil kurs global real-time (basis IDR) dari API publik gratis
                    let currencyRes = await axios.get('https://open.er-api.com/v6/latest/IDR');
                    if (currencyRes.data && currencyRes.data.rates) {
                        let baseRates = currencyRes.data.rates;
                        let convertedRates = {};
                        
                        // Membalik nilai agar menjadi (1 Mata Asing = X IDR) untuk seluruh mata uang dunia
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
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9'
                    }
                });

                const $ = cheerio.load(response.data);
                let price = 0;
                let currency = 'USD';

                if (url.includes('amazon.co.jp')) {
                    currency = 'JPY';
                    let rawPrice = $('.a-price-whole').first().text().replace(/,/g, '');
                    price = parseFloat(rawPrice) || 0;
                } else if (url.includes('amazon.sg')) {
                    currency = 'SGD';
                    let rawPrice = $('.a-price-whole').first().text().replace(/,/g, '');
                    price = parseFloat(rawPrice) || 0;
                } else if (url.includes('amazon.com')) {
                    currency = 'USD';
                    let rawPrice = $('.a-price-whole').first().text().replace(/,/g, '');
                    let fraction = $('.a-price-fraction').first().text() || '00';
                    price = parseFloat(`${rawPrice}.${fraction}`) || 0;
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
