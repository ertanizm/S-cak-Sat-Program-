document.addEventListener('DOMContentLoaded', async () => {
    // Kullanıcı bilgilerini göster
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (userData) {
        document.getElementById('userDisplay').textContent = 
            `Kullanıcı: ${userData.adi} (${userData.kayitNo})`;
    }

    // Barkod input olayını dinle
    const barkodInput = document.getElementById('barkod');
    barkodInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await handleBarkod(barkodInput.value);
            barkodInput.value = '';
        }
    });
});

async function handleBarkod(barkod) {
    try {
        const response = await fetch(`/api/stok/barkod/${barkod}`);
        const data = await response.json();

        if (response.ok) {
            addToList({
                barkod: data.AktifBarkod,
                urunAdi: data.StokAdi,
                giris: data.Giris,
                cikis: data.Cikis,
                mevcutMiktar: data.Miktar,
                stokKayitNo: data.StokKayitNo
            });
        } else {
            alert(data.error || 'Ürün bulunamadı!');
        }
    } catch (err) {
        console.error('Hata:', err);
        alert('İşlem sırasında bir hata oluştu');
    }
}

function addToList(urun) {
    // Aynı barkod daha önce eklendi mi kontrol et
    const mevcutSatir = document.querySelector(`tr[data-barkod="${urun.barkod}"]`);
    if (mevcutSatir) {
        alert('Bu ürün zaten listeye eklenmiş!');
        return;
    }

    const tbody = document.getElementById('stokList');
    const row = document.createElement('tr');
    row.setAttribute('data-barkod', urun.barkod);
    row.setAttribute('data-stok-kayitno', urun.stokKayitNo);
    // Çift tıklama olayı ekle
    row.addEventListener('dblclick', () => confirmDelete(row));
    
    row.innerHTML = `
        <td data-label="Barkod">${urun.barkod}</td>
        <td data-label="Ürün Adı">${urun.urunAdi}</td>
        <td data-label="Giriş">${urun.giris}</td>
        <td data-label="Çıkış">${urun.cikis}</td>
        <td data-label="Mevcut Miktar">${urun.mevcutMiktar}</td>
        <td data-label="Miktar">
            <input type="number" value="1" min="1" 
                onchange="updateMiktar(this, '${urun.barkod}')" class="miktar-input">
        </td>
        <td data-label="İşlem">
            <button onclick="updateRow(this)" class="update-btn">Güncelle</button>
        </td>
    `;
    
    tbody.appendChild(row);
}

// Silme onayı iste
function confirmDelete(row) {
    if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
        row.remove();
    }
}

function updateMiktar(input, barkod) {
    // Miktar güncelleme işlemleri buraya gelecek
    console.log(`Barkod: ${barkod}, Yeni miktar: ${input.value}`);
}

// Güncelleme işlemi
async function updateRow(btn) {
    const row = btn.closest('tr');
    const barkod = row.getAttribute('data-barkod');
    const miktar = row.querySelector('.miktar-input').value;
    const fisNo = document.getElementById('fisNo').textContent;
    
    // Tablodaki tüm satırları topla
    const stoklar = [];
    document.querySelectorAll('#stokList tr').forEach(row => {
        stoklar.push({
            stokKayitNo: parseInt(row.getAttribute('data-stok-kayitno')),
            miktar: parseFloat(row.querySelector('.miktar-input').value),
            giris: parseFloat(row.querySelector('[data-label="Giriş"]').textContent),
            cikis: parseFloat(row.querySelector('[data-label="Çıkış"]').textContent),
            mevcutMiktar: parseFloat(row.querySelector('[data-label="Mevcut Miktar"]').textContent)
        });
    });
    
    try {
        const response = await fetch('/api/sayim/kaydet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fisNo: parseInt(fisNo),
                stoklar: stoklar
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Sayım fişi başarıyla kaydedildi!');
        } else {
            throw new Error(data.error || 'Kayıt sırasında bir hata oluştu');
        }
    } catch (err) {
        console.error('Güncelleme hatası:', err);
        alert('Güncelleme sırasında bir hata oluştu: ' + err.message);
    }
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            sessionStorage.clear();
            window.location.href = '/login.html';
        });
}

// Fiş No düzenleme işlemleri
function editFisNo() {
    const fisNoDisplay = document.getElementById('fisNo');
    const fisNoEdit = document.getElementById('fisNoEdit');
    const fisNoInput = document.getElementById('fisNoInput');

    // Mevcut değeri input'a aktar
    fisNoInput.value = fisNoDisplay.textContent;

    // Görünümleri değiştir
    fisNoDisplay.style.display = 'none';
    fisNoEdit.style.display = 'flex';

    // Input'a fokuslan
    fisNoInput.focus();
    fisNoInput.select();
}

function saveFisNo() {
    const fisNoDisplay = document.getElementById('fisNo');
    const fisNoEdit = document.getElementById('fisNoEdit');
    const fisNoInput = document.getElementById('fisNoInput');

    // Değeri güncelle
    const newValue = parseInt(fisNoInput.value) || 1;
    fisNoDisplay.textContent = newValue;

    // Görünümleri değiştir
    fisNoDisplay.style.display = 'inline';
    fisNoEdit.style.display = 'none';
}

function cancelFisNo() {
    const fisNoDisplay = document.getElementById('fisNo');
    const fisNoEdit = document.getElementById('fisNoEdit');

    // Görünümleri değiştir
    fisNoDisplay.style.display = 'inline';
    fisNoEdit.style.display = 'none';
}

// Enter ve Escape tuşları için olay dinleyicisi
document.getElementById('fisNoInput').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        saveFisNo();
    } else if (e.key === 'Escape') {
        cancelFisNo();
    }
}); 