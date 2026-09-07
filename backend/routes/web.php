<?php

use Illuminate\Support\Facades\Route;

// Satu halaman shell untuk SPA React. Rute lain (mis. /documents/5) ditangani
// React Router di sisi klien — di server semuanya jatuh ke shell yang sama,
// KECUALI /api/* yang didaftarkan terpisah lewat routes/api.php.
Route::view('/{any?}', 'app')->where('any', '^(?!api).*$');
