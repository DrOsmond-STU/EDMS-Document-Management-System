<?php

// Kunci rahasia bersama antara instance EDMS ini dan tool penerbit lisensi
// vendor (aplikasi terpisah, di luar EDMS). HARUS sama persis di kedua sisi,
// dan HANYA dua pihak itu yang tahu — tidak pernah dikirim ke browser klien,
// tidak muncul di respons API manapun. Kalau nilainya beda antar deploy,
// setiap lisensi yang pernah diterbitkan akan langsung dianggap tidak valid
// (tanda tangan tidak cocok), jadi JANGAN diubah tanpa menerbitkan ulang
// lisensi lewat tool vendor.
return [
    'signing_secret' => env('LICENSE_SIGNING_SECRET'),
];
