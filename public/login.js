document.addEventListener('DOMContentLoaded', async () => {
    // Kullanıcıları yükle
    try {
        console.log('Kullanıcılar yükleniyor...');
        const response = await fetch('/api/users');
        console.log('API yanıtı:', response.status);
        const users = await response.json();
        console.log('Kullanıcı listesi:', users);
        
        if (!Array.isArray(users)) {
            throw new Error('Geçersiz veri formatı');
        }

        const userSelect = document.getElementById('userSelect');
        userSelect.innerHTML = '<option value="">Kullanıcı Seçiniz</option>';

        users.forEach(user => {
            if (user && user.KullaniciAdi) {
                const option = document.createElement('option');
                option.value = user.KullaniciAdi;
                option.textContent = user.KullaniciAdi;
                userSelect.appendChild(option);
            }
        });
    } catch (err) {
        console.error('Kullanıcılar yüklenirken hata:', err.message);
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = 'Kullanıcı listesi yüklenemedi: ' + err.message;
        errorMessage.style.display = 'block';
    }

    // Login form işlemi
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('userSelect').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Kullanıcı bilgilerini sessionStorage'a kaydet
                sessionStorage.setItem('userData', JSON.stringify(data.userData));
                window.location.href = '/stoksayim.html';
            } else {
                errorMessage.textContent = data.error;
                errorMessage.style.display = 'block';
            }
        } catch (err) {
            errorMessage.textContent = 'Bir hata oluştu. Lütfen tekrar deneyin.';
            errorMessage.style.display = 'block';
        }
    });
}); 