🍔 Sistem Pemesanan Makanan Multi-Agent
Selamat datang di Proyek Sistem Pemesanan Makanan Berbasis Multi-Agent! Proyek ini mendemonstrasikan bagaimana dua agen cerdas—Customer Agent dan Provider Agent—dapat berkomunikasi dan bernegosiasi untuk menyelesaikan proses pemesanan makanan secara otonom.

Komunikasi antara agen disimulasikan menggunakan protokol FIPA ACL (Agent Communication Language), sebuah standar untuk interaksi antar agen cerdas.

✨ Fitur Utama
Komunikasi Agen Cerdas: Simulasi percakapan antara Customer dan Provider menggunakan FIPA ACL performatives (request, inform, propose, accept-proposal, confirm).

Manajemen Menu & Stok Dinamis: Provider Agent mengelola daftar menu, harga, dan ketersediaan stok secara real-time.

Negosiasi & Substitusi: Jika item yang dipesan habis, Provider Agent dapat mengusulkan item pengganti (substitusi) kepada Customer Agent.

Konfirmasi Pesanan: Alur konfirmasi yang jelas untuk memastikan kedua agen setuju sebelum pesanan final dibuat.

Antarmuka Pengguna Interaktif: Frontend modern yang dibangun dengan React untuk memudahkan interaksi dengan Customer Agent.

⚙️ Teknologi yang Digunakan
Arsitektur proyek ini dibagi menjadi dua bagian utama:

Bagian

Teknologi

Deskripsi

Backend

FastAPI (Python)

Menyediakan API untuk frontend dan menjalankan logika agen.

Frontend

React + Vite & Tailwind CSS

Antarmuka pengguna yang cepat dan responsif.

Komunikasi

FIPA ACL Protocol

Standar komunikasi yang disimulasikan antar agen.

📂 Struktur Proyek
Struktur direktori dirancang agar mudah dikelola, dengan pemisahan yang jelas antara backend dan frontend.

food-multi-agent-system/
│
├── backend/ # Logika aplikasi dan agen (FastAPI)
│ ├── app/
│ │ ├── agents/ # Definisi CustomerAgent dan ProviderAgent
│ │ ├── models/ # Model data (Pydantic)
│ │ └── api/ # Router dan endpoint API
│ ├── main.py # Entrypoint server FastAPI
│ └── requirements.txt # Daftar dependensi Python
│
└── frontend/ # Antarmuka pengguna (React)
├── src/
│ ├── components/ # Komponen UI
│ ├── App.jsx # Komponen utama
│ └── main.jsx # Entrypoint aplikasi React
├── package.json # Daftar dependensi Node.js
└── ...

▶️ Cara Menjalankan Proyek
Ikuti langkah-langkah di bawah ini untuk menjalankan proyek secara lokal.

Kebutuhan Awal
Python 3.8+

Node.js 16+ dan npm

Git

1. Clone Repository
   Buka terminal Anda dan jalankan perintah berikut:

git clone [https://github.com/username/food-multi-agent-system.git](https://github.com/username/food-multi-agent-system.git)
cd food-multi-agent-system

2. Jalankan Backend (FastAPI)
   Backend bertanggung jawab atas logika agen dan penyediaan data.

# 1. Masuk ke direktori backend

cd backend

# 2. Buat dan aktifkan virtual environment

python -m venv venv

# Windows

venv\Scripts\activate

# macOS/Linux

source venv/bin/activate

# 3. Install semua dependensi yang dibutuhkan

pip install -r requirements.txt

# 4. Jalankan server FastAPI

uvicorn main:app --reload

Backend sekarang berjalan dan siap menerima permintaan di 👉 http://localhost:8000.
Anda dapat mengakses dokumentasi API interaktif di http://localhost:8000/docs.

3. Jalankan Frontend (React)
   Frontend menyediakan antarmuka untuk berinteraksi dengan sistem.

# 1. Buka terminal baru dan masuk ke direktori frontend

cd frontend

# 2. Install semua dependensi

npm install

# 3. Jalankan server development

npm run dev

Aplikasi frontend sekarang dapat diakses melalui browser di 👉 http://localhost:5173.

🛠️ Cara Menggunakan Aplikasi
Setelah backend dan frontend berjalan, Anda dapat mulai berinteraksi dengan sistem.

Buka Aplikasi: Buka http://localhost:5173 di browser Anda.

Minta Menu: Customer Agent akan memulai komunikasi dengan mengirim pesan (request (menu)) ke Provider Agent.

Lihat Menu: Provider Agent akan merespons dengan pesan (inform (menu ...)) yang berisi daftar makanan, harga, dan stok yang tersedia.

Lakukan Pemesanan: Pilih item yang ingin dipesan. Customer Agent akan mengirim pesan (request (order ...)).

Proses Negosiasi:

Jika semua item tersedia, Provider Agent akan mengirim (propose (delivery ...)) dengan total biaya dan ongkos kirim.

Jika ada item yang stoknya habis, Provider Agent akan mengirim (propose (substitution ...)) yang menyarankan item pengganti.

Konfirmasi Pesanan: Customer Agent dapat menyetujui proposal dengan mengirim (accept-proposal ...) atau menolaknya.

Pesanan Selesai: Setelah proposal diterima, Provider Agent akan mengirim (confirm (order-placed)) dan pesanan dianggap berhasil dibuat.

Seluruh pertukaran pesan ini dapat dilihat di antarmuka pengguna untuk memahami alur komunikasi agen.

💬 Contoh Alur Pesan FIPA ACL
Berikut adalah contoh sederhana alur komunikasi antara agen:

Customer → Provider: Meminta daftar menu.
(request :sender CustomerAgent :receiver ProviderAgent :content (menu))

Provider → Customer: Memberikan daftar menu.
(inform :sender ProviderAgent :receiver CustomerAgent :content (menu (item "Nasi Goreng" 15000 10) (item "Mie Ayam" 12000 0)))

Customer → Provider: Memesan item yang stoknya habis.
(request :sender CustomerAgent :receiver CustomerAgent :content (order (item "Mie Ayam" 1)))

Provider → Customer: Mengusulkan item pengganti.
(propose :sender ProviderAgent :receiver CustomerAgent :content (substitution (original "Mie Ayam") (replacement "Mie Goreng" 13000)))

Customer → Provider: Menerima usulan.
(accept-proposal :sender CustomerAgent :receiver ProviderAgent :content (order-final (item "Mie Goreng" 1)))

Provider → Customer: Mengonfirmasi pesanan akhir.
(confirm :sender ProviderAgent :receiver CustomerAgent :content (order-placed))
