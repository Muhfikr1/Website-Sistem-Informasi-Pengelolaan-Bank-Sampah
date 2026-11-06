export const siteConfig = {
    name: "Bank Sampah Digital",
    tagline: "Sistem Informasi Pengelolaan Terpadu",

    // 1. PROFIL
    profile: {
        headline: "Ubah Sampah Menjadi Tabungan yang Bernilai",
        summary:
            "Bank Sampah Digital adalah layanan pengelolaan sampah anorganik berbasis tabungan. Warga menyetorkan sampah terpilah, petugas menimbang dan mencatatnya, lalu nilainya masuk otomatis ke saldo nasabah dan dapat ditarik kapan saja.",
        highlights: [
            "Harga setoran dibekukan saat transaksi, jadi riwayat tidak berubah walau harga naik turun.",
            "Berkas pribadi seperti KTP disimpan privat dan hanya bisa dibuka pemilik serta admin.",
            "Notifikasi langsung ke perangkat Anda saat setoran atau penarikan diproses.",
        ],
    },

    // 4. PROSEDUR SETORAN
    procedure: [
        {
            title: "Daftar & Unggah KTP",
            description: "Buat akun nasabah dan unggah dokumen KTP atau berkas pendaftaran Anda.",
        },
        {
            title: "Pilah Sampah",
            description: "Pisahkan sampah sesuai jenis dan pastikan dalam keadaan bersih dan kering.",
        },
        {
            title: "Bawa ke Lokasi",
            description: "Datang pada jam operasional dan serahkan sampah kepada petugas.",
        },
        {
            title: "Penimbangan & Pencatatan",
            description: "Petugas menimbang, mencatat, dan menghitung nilainya sesuai harga terbaru.",
        },
        {
            title: "Saldo Bertambah",
            description: "Nilai setoran masuk ke saldo Anda dan dapat diajukan penarikan kapan saja.",
        },
    ],

    // 5. JADWAL OPERASIONAL
    schedule: [
        { day: "Senin – Jumat", hours: "08.00 – 15.00 WIB", open: true },
        { day: "Sabtu", hours: "08.00 – 12.00 WIB", open: true },
        { day: "Minggu & Hari Libur Nasional", hours: "Tutup", open: false },
    ],

    // 6. LOKASI (GANTI DENGAN ALAMAT ASLI BANK SAMPAH ANDA)
    location: {
        placeName: "Kantor Bank Sampah Digital",
        address: "Sekaran, Gunungpati, Semarang, Jawa Tengah 50229",
        // Teks pencarian untuk peta Google (nama tempat + kota, atau "lat,lng")
        mapQuery: "Bank Sampah Induk, Indonesia",
        phone: "0812-0000-0000",
        email: "admin@banksampah.id",
    },
} as const;