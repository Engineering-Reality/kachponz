# Brief Ilustrasi Tambahan: My Mind Palace Vol. I

Dokumen ini mendefinisikan kebutuhan aset ilustrasi baru untuk mendukung nuansa buku cerita bergambar ajaib tanpa meniru karakter berhak cipta.

---

## 1. Panduan Gaya Visual Ilustrasi

* **Gaya Utama:** Line-art hitam-putih hangat (gaya buku mewarnai elegan) dengan garis tebal-tipis organik (*hand-drawn ink stroke*).
* **Karakter Maskot:** Kelinci kecil putih dengan telinga ekspresif, mata bulat ingin tahu, dan proporsi tubuh mungil yang menggemaskan.
* **Karakter Naratif (Nara):** Mahasiswa muda dengan tas ransel atau buku catatan sketsa, berpenampilan kasual dan hangat.
* **Aturan Orisinalitas:** DILARANG meniru atau mereferensikan karakter komersial berhak cipta (seperti Miffy, Peter Rabbit, dsb.). Maskot adalah karakter orisinal istana pikiran.

---

## 2. Daftar Kebutuhan Aset Ilustrasi

| No | Nama Aset | Ukuran Target | Deskripsi Adegan & Emosi | Penempatan dalam Buku |
| :--- | :--- | :--- | :--- | :--- |
| **01** | `palace-castle-facade.webp` | 1024 × 768 px | Tampak depan Istana Pikiran dengan 6 jendela lengkung berornamen bintang dan menara kecil di bawah langit berbintang. | Peta Istana (`PalaceMap.tsx`) |
| **02** | `bunny-with-star.webp` | 800 × 800 px | Kelinci kecil memeluk bintang emas berkilau dengan senyum bangga dan riang. | Kartu Karakter Koleksi & Selebrasi Kuis |
| **03** | `bunny-rubber-duck.webp` | 800 × 800 px | Kelinci duduk di samping bebek karet kecil di atas meja kerja, seperti sedang berdiskusi memecahkan bug (*rubber duck debugging*). | Callout Cara Developer (Bab 2) |
| **04** | `nara-sketchbook.webp` | 900 × 700 px | Nara sedang duduk di bangku taman sambil mencatat ide di buku sketsa dengan pensil kayu. | Kisah Nara (Bab 3 & 4) |
| **05** | `palace-door-paradox.webp` | 700 × 900 px | Pintu kayu besar berukir roda gigi dan tanda tanya, sedikit terbuka memancarkan cahaya lembut. | Pembuka Ruang Paradoks (Bab 1) |
| **06** | `sticker-badges-set.webp` | 1200 × 800 px | 6 stiker lencana ruangan (Kunci Pertanyaan, Kompas, Cermin, Kuas, Botol Wow, Perisai) berformat stiker dengan tepi putih tebal. | Peta Istana & Sertifikat Akhir |

---

## 3. Strategi Placeholder

Selama aset raster resolusi tinggi sedang digambar, antarmuka e-book menggunakan:
1. Komponen SVG modular dinamis: `BunnyBuddy.tsx` (telinga, mata, badan teranimasi).
2. Ornamen SVG line-art: `StarOrnaments.tsx` dan `RibbonWave.tsx`.
3. Bingkai organik bergaya sketsa: `SketchBorder.tsx`.
