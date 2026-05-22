export const products = {
  'agent-studio': {
    title: 'Agent Studio',
    subtitle: 'Platform sebagai Layanan (PaaS)',
    tagline: 'AMADEUS AI · AGENT STUDIO',
    heroDesc: 'Rancang, luncurkan, dan kelola agen AI kustom melalui satu perintah operasional — tanpa pemrograman yang rumit.',
    image: '/product_agent_studio.png',
    images: ['/cap_01.jpg', '/cap_02.jpg', '/cap_03.jpg', '/cap_04.jpg', '/cap_05.jpg'],
    color: '#8b5cf6',
    steps: [
      {
        title: 'Pembuatan Agen Berbasis Satu Prompt',
        desc: 'Tentukan perilaku, persona, dan kemampuan agen AI Anda menggunakan satu prompt bahasa alami. Amadeus menangani sisanya — mulai dari arsitektur hingga peluncuran.',
      },
      {
        title: 'Pembangun Alur Kerja Visual',
        desc: 'Antarmuka seret-dan-lepas untuk menghubungkan sumber data, API, dan pohon keputusan. Buat alur kerja agen multi-langkah yang kompleks tanpa menulis kode.',
      },
      {
        title: 'Mesin Instruksi & Persona',
        desc: 'Konfigurasikan profil kepribadian agen, gaya komunikasi, dan batasan operasional. Sesuaikan setiap interaksi agar selaras dengan identitas merek dan standar kepatuhan Anda.',
      },
      {
        title: 'Integrasi Ekosistem Modul',
        desc: 'Hubungkan agen Anda dengan lancar ke berbagai perangkat perusahaan yang ada — CRM, ERP, basis data, dan layanan pihak ketiga melalui pustaka modul modular kami.',
      },
      {
        title: 'Dasbor Pemantauan Real-Time',
        desc: 'Pantau performa agen, interaksi pengguna, dan tingkat kesalahan secara real-time. Dapatkan wawasan yang dapat ditindaklanjuti untuk terus meningkatkan efektivitas asisten AI Anda.',
      },
    ],
  },

  'microservices': {
    title: 'Microservices APIs',
    subtitle: 'Inteligensi Modular',
    tagline: 'AMADEUS AI · MICROSERVICES',
    heroDesc: 'Luncurkan kemampuan AI spesifik sebagai modul API mandiri. Setiap layanan dapat diskalakan secara independen dan siap untuk kebutuhan korporasi.',
    image: '/product_microservices.png',
    images: ['/micro_01.jpg', '/micro_02.jpg', '/micro_03.jpg', '/micro_04.jpg', '/micro_05.jpg'],
    color: '#3b82f6',
    steps: [
      {
        title: 'Layanan Pengisian Otomatis Bidang Agen',
        desc: 'Pengisian formulir berbasis AI yang memahami konteks. Secara otomatis mengisi formulir kompleks dengan menganalisis unggahan dokumen, entri sebelumnya, dan niat pengguna.',
      },
      {
        title: 'Layanan Pengujian Situs Web',
        desc: 'Pengujian QA otomatis yang didukung oleh agen AI. Deteksi bug UI, alur yang terputus, dan masalah performa di seluruh aplikasi web Anda tanpa bantuan skrip manual.',
      },
      {
        title: 'Protokol Berbagi Fitur',
        desc: 'Memungkinkan pertukaran kemampuan antar-agen di dalam organisasi Anda. Agen dapat menemukan dan memanfaatkan keahlian khusus satu sama lain melalui protokol bersama.',
      },
      {
        title: 'Penskalaan & Penagihan Independen',
        desc: 'Setiap layanan mikro berjalan secara independen dengan kebijakan penskalaan dan pelacakan penggunaan masing-masing. Bayar hanya yang Anda gunakan, skali sesuai kebutuhan.',
      },
      {
        title: 'SDK & Gerbang API',
        desc: 'Gerbang API terpadu dengan autentikasi bawaan, pembatasan akses (rate limiting), dan pemantauan. SDK tersedia untuk Python, Node.js, dan Go untuk integrasi cepat.',
      },
    ],
  },

  'fine-tuning': {
    title: 'Fine-Tuning & RLHF',
    subtitle: 'Optimasi Model',
    tagline: 'AMADEUS AI · RLHF PIPELINE',
    heroDesc: 'Adaptasikan model dasar terbaik ke data perusahaan Anda menggunakan loop umpan balik manusia untuk peningkatan kualitas AI secara berkelanjutan.',
    image: '/product_rlhf.png',
    images: ['/rlhf_01.jpg', '/rlhf_02.jpg', '/rlhf_03.jpg', '/rlhf_04.jpg', '/rlhf_05.jpg'],
    color: '#06b6d4',
    steps: [
      {
        title: 'Ingesti Data Perusahaan',
        desc: 'Impor kumpulan data internal Anda secara aman. Mendukung data terstruktur, tidak terstruktur, dan multi-format dengan prapemrosesan serta validasi otomatis.',
      },
      {
        title: 'Fine-Tuning Terawasi (SFT)',
        desc: 'Latih model dasar pada kasus penggunaan spesifik Anda dengan pasangan instruksi-respons yang terkurasi. Tingkatkan keahlian domain dalam konteks hukum, medis, atau keuangan.',
      },
      {
        title: 'Saluran Umpan Balik RLHF',
        desc: 'Evaluator manusia memberikan peringkat dan skor pada hasil model secara real-time. Reinforcement learning mengoptimalkan model sesuai standar kualitas Anda pada setiap iterasi.',
      },
      {
        title: 'Tolok Ukur Kualitas Otomatis',
        desc: 'Evaluasi berkelanjutan terhadap berbagai rangkaian pengujian kustom. Lacak akurasi, skor keamanan, dan integritas respons di berbagai versi model secara otomatis.',
      },
      {
        title: 'Peluncuran Model Satu-Klik',
        desc: 'Luncurkan model yang telah dioptimalkan ke produksi dengan satu klik. Termasuk kemampuan kontrol versi otomatis, fitur rollback, dan infrastruktur pengujian A/B.',
      },
    ],
  },

  'on-premise': {
    title: 'On-Premise Private Cloud',
    subtitle: 'Tanpa Dependensi Cloud',
    tagline: 'AMADEUS AI · PRIVATE INFRASTRUCTURE',
    heroDesc: 'Jalankan seluruh infrastruktur AI Anda 100% secara lokal. Dirancang untuk sektor perbankan, hukum, dan kesehatan yang menuntut kedaulatan data absolut.',
    image: '/product_onpremise.png',
    images: ['/onprem_01.jpg', '/onprem_02.jpg', '/onprem_03.jpg', '/onprem_04.jpg', '/onprem_05.jpg'],
    color: '#10b981',
    steps: [
      {
        title: 'Deployment Terisolasi (Air-Gapped)',
        desc: 'Infrastruktur AI lengkap yang beroperasi tanpa koneksi internet. Data Anda tidak pernah meninggalkan lokasi perusahaan — dijamin nol transfer data eksternal.',
      },
      {
        title: 'Runtime Teroptimasi Perangkat Keras',
        desc: 'Secara otomatis mendeteksi dan mengoptimalkan penggunaan hardware Anda. Mendukung konfigurasi NVIDIA, AMD, dan akselerator kustom untuk kecepatan inferensi maksimal.',
      },
      {
        title: 'Kepatuhan & Jejak Audit',
        desc: 'Pencatatan log bawaan untuk kepatuhan SOC2, HIPAA, dan GDPR. Setiap akses data, kueri model, dan tindakan agen dicatat dalam log audit yang tahan gangguan.',
      },
      {
        title: 'Registri Model Privat',
        desc: 'Kelola model yang telah di-fine-tune dalam registri internal yang aman. Kontrol versi, manajemen akses, dan alur persetujuan untuk tata kelola model yang ketat.',
      },
      {
        title: 'Dukungan Perusahaan & SLA',
        desc: 'Dukungan teknik on-site khusus dengan jaminan uptime 99,9%. Hotline langsung, perbaikan (patch) prioritas, dan bantuan deployment yang dipersonalisasi.',
      },
    ],
  },

  'mcp-bridge': {
    title: 'MCP Bridge',
    subtitle: 'Integrasi Basis Data',
    tagline: 'AMADEUS AI · MODEL CONTEXT PROTOCOL',
    heroDesc: 'Hubungkan basis data internal Anda secara aman ke LLM modern menggunakan Model Context Protocol yang terbuka.',
    image: '/product_mcp.png',
    images: ['/mcp_01.jpg', '/mcp_02.jpg', '/mcp_03.jpg', '/mcp_04.jpg', '/mcp_05.jpg'],
    color: '#f59e0b',
    steps: [
      {
        title: 'Konektor Basis Data Universal',
        desc: 'Konektor siap pakai (plug-and-play) untuk PostgreSQL, MySQL, MongoDB, Oracle, dan basis data COBOL lama. Tidak memerlukan migrasi data yang rumit.',
      },
      {
        title: 'Injeksi Konteks Real-Time',
        desc: 'Masukkan data perusahaan langsung ke dalam jendela konteks LLM secara real-time. Agen menjawab pertanyaan menggunakan data aktual Anda, bukan pengetahuan usang.',
      },
      {
        title: 'Lapisan Keamanan Kueri',
        desc: 'Kontrol akses berbasis peran memastikan agen hanya menanyakan data yang berwenang mereka lihat. Masking PII dan anonimisasi data diterapkan secara otomatis.',
      },
      {
        title: 'Verifikasi Sumber Data',
        desc: 'Setiap respons AI didasarkan pada sumber data yang dapat diverifikasi. Pembuatan sitasi bawaan menghubungkan jawaban langsung ke asal basis datanya.',
      },
      {
        title: 'Marketplace Konektor MCP',
        desc: 'Telusuri dan luncurkan konektor siap pakai untuk sistem perusahaan populer — SAP, Salesforce, Jira, dan lainnya. Tersedia pula SDK untuk konektor kustom.',
      },
    ],
  },

  'multimodal': {
    title: 'Multimodal Inference',
    subtitle: 'AI Visi + Bahasa',
    tagline: 'AMADEUS AI · MULTIMODAL ENGINE',
    heroDesc: "Didukung oleh Projection Adapter dari Fira, memungkinkan model ringkas untuk memahami gambar dengan akurasi tinggi pada biaya infrastruktur yang minimal.",
    image: '/product_multimodal.png',
    color: '#ec4899',
    steps: [
      {
        title: 'Teknologi Adaptor Proyeksi',
        desc: "Teknik terobosan Fira yang memetakan fitur visual ke dalam ruang model bahasa. Capai akurasi setingkat GPT-4V dengan model yang 10x lebih kecil dan efisien.",
      },
      {
        title: 'Deployment Perangkat Edge',
        desc: 'Jalankan inferensi multimodal langsung pada perangkat edge — kamera pintar, robot industri, drone — tanpa dependensi API cloud atau biaya operasional berulang.',
      },
      {
        title: 'Pemrosesan Input Multi-Format',
        desc: 'Proses gambar, video, dokumen, dan input media campuran dalam satu saluran. Termasuk fitur deteksi format dan prapemrosesan otomatis yang cerdas.',
      },
      {
        title: 'Fine-Tuning Visi Kustom',
        desc: 'Latih adaptor visual untuk kasus penggunaan spesifik Anda — mulai dari pencitraan medis, deteksi cacat manufaktur, hingga analitik ritel tingkat lanjut.',
      },
      {
        title: 'Model Lisensi Perangkat Lunak',
        desc: 'Lisensikan mesin multimodal kepada produsen perangkat keras. Integrasi white-label untuk OEM yang membangun sistem CCTV pintar atau kendaraan otonom.',
      },
    ],
  },

  'model-evaluation': {
    title: 'Model Evaluation',
    subtitle: 'Penjaminan Kualitas AI',
    tagline: 'AMADEUS AI · EVALUATION SUITE',
    heroDesc: 'Lakukan benchmark, uji penetrasi (red-team), dan validasi model AI Anda secara ketat terhadap berbagai kasus ekstrem dunia nyata sebelum deployment.',
    image: '/product_evaluation.png',
    color: '#ef4444',
    steps: [
      {
        title: 'Pembuatan Rangkaian Pengujian Otomatis',
        desc: 'Kasus uji generatif AI yang mencakup skenario ekstrem, input adversarial, dan bias yang spesifik untuk domain serta kasus penggunaan unik model Anda.',
      },
      {
        title: 'Simulasi Red Team',
        desc: 'Serangan adversarial otomatis untuk menguji batasan keamanan model Anda. Identifikasi potensi kerentanan sistem sebelum aktor jahat menemukannya.',
      },
      {
        title: 'Dasbor Penilaian Multi-Metrik',
        desc: 'Pelacakan akurasi, latensi, keamanan, keadilan, dan integritas respons di berbagai versi model dengan perbandingan berdampingan terhadap benchmark industri.',
      },
      {
        title: 'Saluran Tinjauan Pakar Manusia',
        desc: 'Pakar domain mengevaluasi hasil model untuk akurasi faktual, kepatuhan regulasi, dan keselarasan merek melalui alur kerja tinjauan manusia yang terstruktur.',
      },
      {
        title: 'Pemantauan Produksi Berkelanjutan',
        desc: 'Peringatan kualitas real-time saat performa model menurun. Deteksi drift otomatis dan pemicu pelatihan ulang untuk menjaga standar operasional produksi.',
      },
    ],
  },

  'data-engine': {
    title: 'Enterprise Data Engine',
    subtitle: 'Platform Data Strategis',
    tagline: 'AMADEUS AI · DATA ENGINE',
    heroDesc: 'Integrasikan data perusahaan Anda ke dalam seluruh siklus hidup AI. Bangun keunggulan data kompetitif untuk diferensiasi strategis jangka panjang.',
    image: '/product_data_engine.png',
    color: '#8b5cf6',
    steps: [
      {
        title: 'Kurasi Data Cerdas',
        desc: 'Seleksi data pelatihan yang paling berdampak dari aset perusahaan Anda menggunakan AI. Pembelajaran aktif mengidentifikasi sampel bernilai tinggi secara otomatis.',
      },
      {
        title: 'Fusi Data Multi-Sumber',
        desc: 'Satukan data dari CRM, email, basis data, dan sensor IoT ke dalam satu kumpulan data yang koheren dan siap dikonsumsi oleh sistem AI perusahaan.',
      },
      {
        title: 'Saluran Anotasi & Kualitas',
        desc: 'Alur kerja anotasi otomatis dan human-in-the-loop. Kontrol kualitas bawaan dengan penskoran kesepakatan antar-anotator serta mekanisme konsensus.',
      },
      {
        title: 'Tata Kelola & Asal-usul Data',
        desc: 'Visibilitas lengkap terhadap asal data, transformasi, dan penggunaannya. Jejak audit yang siap memenuhi persyaratan kepatuhan di industri yang teregulasi.',
      },
      {
        title: 'Flywheel Data Berkelanjutan',
        desc: 'Hasil model produksi diumpankan kembali ke saluran data. AI Anda meningkat secara otomatis seiring perusahaan menghasilkan lebih banyak data seiring waktu.',
      },
    ],
  },
}
