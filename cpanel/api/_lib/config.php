<?php
// ISI FILE INI dengan kredensial database MySQL dari cPanel Anda
// (menu "MySQL Databases"). Nama database & user biasanya otomatis
// diawali "namacpanel_", contoh: "cpaneluser_edms" / "cpaneluser_edmsuser".
return [
    'db_host' => 'localhost',
    'db_name' => 'GANTI_NAMA_DATABASE',
    'db_user' => 'GANTI_NAMA_USER',
    'db_pass' => 'GANTI_PASSWORD',

    // Opsional tapi direkomendasikan untuk produksi sungguhan: string acak
    // panjang (mis. hasil `bin2hex(random_bytes(32))`) untuk menandatangani
    // cookie sesi login. Kosongkan ('') untuk membiarkan sistem menurunkan
    // secret otomatis dari kredensial database di atas — cukup untuk
    // prototipe, tapi secret ikut berubah jika kredensial DB diganti.
    'session_secret' => '',
];
