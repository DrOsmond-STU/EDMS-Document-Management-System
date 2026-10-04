<?php

return [
    /*
     * Host internal (jaringan privat) yang BOLEH dihubungi integrasi SMTP/LDAP,
     * dipisah koma — mis. "ad.kantor.local,10.0.0.5". Kosong = hanya alamat
     * internet publik. Sengaja diatur di .env server (bukan di aplikasi) supaya
     * admin aplikasi tidak bisa membuka akses ke jaringan internal sendirian.
     */
    'private_hosts' => env('INTEGRATION_PRIVATE_HOSTS', ''),
];
