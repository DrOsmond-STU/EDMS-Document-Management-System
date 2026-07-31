<?php
// ISI FILE INI dengan kredensial database MySQL dari cPanel Anda
// (menu "MySQL Databases"). Nama database & user biasanya otomatis
// diawali "namacpanel_", contoh: "cpaneluser_edms" / "cpaneluser_edmsuser".
return [
    'db_host' => 'localhost',
    'db_name' => 'GANTI_NAMA_DATABASE',
    'db_user' => 'GANTI_NAMA_USER',
    'db_pass' => 'GANTI_PASSWORD',

    // Opsional: isi dengan password bebas untuk mengaktifkan gerbang login.
    // Kosongkan ('') untuk menonaktifkan (siapa pun dengan link bisa akses).
    'app_password' => '',
];
