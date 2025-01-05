const express = require('express');
const sql = require('mssql');
const session = require('express-session');
const path = require('path');

const app = express();

// Middleware ayarları
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'gizli-anahtar',
    resave: false,
    saveUninitialized: true
}));

// Auth middleware - tüm istekleri kontrol et
app.use((req, res, next) => {
    // Login sayfası ve API isteklerini bypass et
    if (req.path === '/login.html' || 
        req.path === '/style.css' || 
        req.path === '/login.js' || 
        req.path.startsWith('/api/')) {
        return next();
    }

    // Oturum kontrolü
    if (!req.session.user && req.path !== '/login.html') {
        return res.redirect('/login.html');
    }
    next();
});

// Statik dosyaları serve et
app.use(express.static('public'));

// MSSQL bağlantı ayarları
const config = {
    user: 'sa',
    password: 'your_password',
    server: '192.168.2.81',
    database: 'your_database',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Ana sayfa yönlendirmesi
app.get('/', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
    } else {
        res.redirect('/index.html');
    }
});

// Kullanıcıları getir
app.get('/api/users', async (req, res) => {
    try {
        await sql.connect(config);
        console.log('Veritabanı bağlantısı başarılı');
        const result = await sql.query`
            SELECT DISTINCT Adi 
            FROM KullaniciKarti 
        `;
        console.log('SQL sorgu sonucu:', result);
        // Sonucu düzgün bir dizi formatına çevir
        const users = result.recordset.map(record => ({
            KullaniciAdi: record.Adi
        }));
        console.log('Gönderilen veri:', users);
        res.json(users);
    } catch (err) {
        console.error('Veritabanı hatası:', err);
        res.status(500).json({ error: err.message });
    } finally {
        sql.close();
    }
});

// Login işlemi
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT Adi, KayitNo
            FROM KullaniciKarti 
            WHERE Adi = ${username} AND Sifre = ${password}
        `;

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            req.session.user = username;
            res.json({ 
                success: true, 
                userData: {
                    adi: user.Adi,
                    kayitNo: user.KayitNo
                }
            });
        } else {
            res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre!' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        sql.close();
    }
});

// Çıkış işlemi
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Veritabanı test
app.get('/api/test', async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query`SELECT TOP 1 * FROM KullaniciKarti`;
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Test hatası:', err);
        res.status(500).json({ error: err.message });
    } finally {
        sql.close();
    }
});

// Stok verilerini çek
app.get('/api/stok/list', async (req, res) => {
    const donemId = req.query.donemId || 17;
    const companyId = req.query.companyId || 1;
    const depo = req.query.depo || 1;
    const girisTipler = req.query.girisTipler || '1,2,3';
    const cikisTipler = req.query.cikisTipler || '4,5,6';

    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT 
                s.StokAdi,
                s.AktifBarkod,
                s.KayitNo as StokKayitNo,
                ISNULL((
                    SELECT SUM(sfd.Miktar) 
                    FROM StokFisDetay sfd 
                    LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                    WHERE sfd.StokKayitNo = s.KayitNo 
                    AND sfb.DonemKayitNo = 17  -- @DonemId
                    AND sfb.SirketKayitNo = 1  -- @CompanyId
                    AND sfb.EFaturaIptal = 0
                    AND sfb.FisTipi IN (1,2,3)  -- @GirisTipler varsayılan değerler
                    AND (sfb.DepoKayitNo = 1 OR 1 = 0)  -- @Depo kontrolü
                ), 0) as Giris,
                ISNULL((
                    SELECT SUM(sfd.Miktar) 
                    FROM StokFisDetay sfd 
                    LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                    WHERE sfd.StokKayitNo = s.KayitNo 
                    AND sfb.DonemKayitNo = 17  -- @DonemId
                    AND sfb.SirketKayitNo = 1  -- @CompanyId
                    AND sfb.EFaturaIptal = 0
                    AND sfb.FisTipi IN (4,5,6)  -- @CikisTipler varsayılan değerler
                    AND (sfb.DepoKayitNo = 1 OR 1 = 0)  -- @Depo kontrolü
                ), 0) as Cikis,
                ISNULL((
                    SELECT SUM(Giris) - SUM(Cikis)
                    FROM (
                        SELECT 
                            ISNULL(SUM(sfd.Miktar), 0) as Giris,
                            0 as Cikis
                        FROM StokFisDetay sfd 
                        LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                        WHERE sfd.StokKayitNo = s.KayitNo 
                        AND sfb.DonemKayitNo = 17
                        AND sfb.SirketKayitNo = 1
                        AND sfb.EFaturaIptal = 0
                        AND sfb.FisTipi IN (1,2,3)
                        AND (sfb.DepoKayitNo = 1 OR 1 = 0)
                        UNION ALL
                        SELECT 
                            0 as Giris,
                            ISNULL(SUM(sfd.Miktar), 0) as Cikis
                        FROM StokFisDetay sfd 
                        LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                        WHERE sfd.StokKayitNo = s.KayitNo 
                        AND sfb.DonemKayitNo = 17
                        AND sfb.SirketKayitNo = 1
                        AND sfb.EFaturaIptal = 0
                        AND sfb.FisTipi IN (4,5,6)
                        AND (sfb.DepoKayitNo = 1 OR 1 = 0)
                    ) t
                ), 0) as Miktar
            FROM 
                StokKarti s
            ORDER BY 
                s.StokAdi
        `;
        
        console.log('Stok verileri yüklendi');
        res.json(result.recordset);
    } catch (err) {
        console.error('Stok verilerini çekerken hata:', err);
        res.status(500).json({ error: err.message });
    } finally {
        sql.close();
    }
});

// Barkoda göre stok bilgisi getir
app.get('/api/stok/barkod/:barkod', async (req, res) => {
    const { barkod } = req.params;
    const donemId = req.query.donemId || 17;
    const companyId = req.query.companyId || 1;
    const depo = req.query.depo || 1;

    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT 
                s.StokAdi,
                s.AktifBarkod,
                s.KayitNo as StokKayitNo,
                ISNULL((
                    SELECT SUM(sfd.Miktar) 
                    FROM StokFisDetay sfd 
                    LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                    WHERE sfd.StokKayitNo = s.KayitNo 
                    AND sfb.DonemKayitNo = ${donemId}
                    AND sfb.SirketKayitNo = ${companyId}
                    AND sfb.EFaturaIptal = 0
                    AND sfb.FisTipi IN (1,2,3)
                    AND (sfb.DepoKayitNo = ${depo} OR ${depo} = 0)
                ), 0) as Giris,
                ISNULL((
                    SELECT SUM(sfd.Miktar) 
                    FROM StokFisDetay sfd 
                    LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                    WHERE sfd.StokKayitNo = s.KayitNo 
                    AND sfb.DonemKayitNo = ${donemId}
                    AND sfb.SirketKayitNo = ${companyId}
                    AND sfb.EFaturaIptal = 0
                    AND sfb.FisTipi IN (4,5,6)
                    AND (sfb.DepoKayitNo = ${depo} OR ${depo} = 0)
                ), 0) as Cikis,
                ISNULL((
                    SELECT SUM(Giris) - SUM(Cikis)
                    FROM (
                        SELECT 
                            ISNULL(SUM(sfd.Miktar), 0) as Giris,
                            0 as Cikis
                        FROM StokFisDetay sfd 
                        LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                        WHERE sfd.StokKayitNo = s.KayitNo 
                        AND sfb.DonemKayitNo = ${donemId}
                        AND sfb.SirketKayitNo = ${companyId}
                        AND sfb.EFaturaIptal = 0
                        AND sfb.FisTipi IN (1,2,3)
                        AND (sfb.DepoKayitNo = ${depo} OR ${depo} = 0)
                        UNION ALL
                        SELECT 
                            0 as Giris,
                            ISNULL(SUM(sfd.Miktar), 0) as Cikis
                        FROM StokFisDetay sfd 
                        LEFT JOIN StokFisBaslik sfb ON sfb.KayitNo = sfd.BaslikKayitNo
                        WHERE sfd.StokKayitNo = s.KayitNo 
                        AND sfb.DonemKayitNo = ${donemId}
                        AND sfb.SirketKayitNo = ${companyId}
                        AND sfb.EFaturaIptal = 0
                        AND sfb.FisTipi IN (4,5,6)
                        AND (sfb.DepoKayitNo = ${depo} OR ${depo} = 0)
                    ) t
                ), 0) as Miktar
            FROM 
                StokKarti s
            WHERE 
                s.AktifBarkod = ${barkod}
        `;
        
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ error: 'Ürün bulunamadı' });
        }
    } catch (err) {
        console.error('Stok bilgisi çekerken hata:', err);
        res.status(500).json({ error: err.message });
    } finally {
        sql.close();
    }
});

// Sayım fişi kaydetme endpoint'i
app.post('/api/sayim/kaydet', async (req, res) => {
    const { fisNo, stoklar } = req.body;
    const userData = req.session.user;

    try {
        await sql.connect(config);

        // Önce bu fişin varlığını kontrol et
        const fisKontrol = await sql.query`
            SELECT KayitNo 
            FROM SayimFisi 
            WHERE SirketKayitNo = 1 
            AND DonemKayitNo = 17 
            AND DepoKayitNo = 1 
            AND FisNo = ${fisNo}
        `;

        let fisKayitNo;

        if (fisKontrol.recordset.length === 0) {
            // Fiş yoksa yeni fiş oluştur
            const fisResult = await sql.query`
                INSERT INTO SayimFisi (
                    SirketKayitNo,
                    DonemKayitNo,
                    DepoKayitNo,
                    FisNo,
                    Tarih
                ) 
                VALUES (
                    1,  -- SirketKayitNo
                    17, -- DonemKayitNo
                    1,  -- DepoKayitNo
                    ${fisNo},
                    GETDATE()
                );
                
                SELECT SCOPE_IDENTITY() as FisKayitNo;
            `;

            fisKayitNo = fisResult.recordset[0].FisKayitNo;
        } else {
            // Fiş varsa mevcut fiş numarasını al
            fisKayitNo = fisKontrol.recordset[0].KayitNo;
        }

        // Stok detaylarını eklemeden önce bu ürünün detayını kontrol et ve güncelle/ekle
        for (const stok of stoklar) {
            const detayKontrol = await sql.query`
                SELECT KayitNo 
                FROM SayimFisDetayi 
                WHERE SayimFisiKayitNo = ${fisKayitNo} 
                AND StokKayitNo = ${stok.stokKayitNo}
            `;

            if (detayKontrol.recordset.length === 0) {
                // Detay yoksa ekle
                await sql.query`
                    INSERT INTO SayimFisDetayi (
                        SayimFisiKayitNo,
                        StokKayitNo,
                        DurumGiris,
                        DurumCikis,
                        DurumStok,
                        GercekStok,
                        BirimKayitNo
                    )
                    VALUES (
                        ${fisKayitNo},
                        ${stok.stokKayitNo},
                        ${stok.giris},
                        ${stok.cikis},
                        ${stok.mevcutMiktar},
                        ${stok.miktar},
                        ${1}
                    )
                `;
            } else {
                // Detay varsa güncelle
                await sql.query`
                    UPDATE SayimFisDetayi 
                    SET GercekStok = ${stok.miktar},
                        DurumGiris = ${stok.giris},
                        DurumCikis = ${stok.cikis},
                        DurumStok = ${stok.mevcutMiktar}
                    WHERE SayimFisiKayitNo = ${fisKayitNo} 
                    AND StokKayitNo = ${stok.stokKayitNo}
                `;
            }
        }

        res.json({ 
            success: true, 
            message: fisKontrol.recordset.length === 0 ? 'Yeni sayım fişi oluşturuldu' : 'Sayım fişi güncellendi',
            fisKayitNo: fisKayitNo 
        });

    } catch (err) {
        console.error('Sayım fişi kaydederken hata:', err);
        res.status(500).json({ error: err.message });
    } finally {
        sql.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 