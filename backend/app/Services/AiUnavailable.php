<?php

namespace App\Services;

use RuntimeException;

/** Kegagalan Asisten AI dengan pesan yang aman ditampilkan ke pengguna. */
class AiUnavailable extends RuntimeException {}
