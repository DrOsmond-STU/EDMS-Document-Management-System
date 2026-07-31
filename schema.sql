-- Tabel ini dibuat otomatis oleh aplikasi saat pertama kali diakses.
-- Import file ini lewat phpMyAdmin HANYA jika Anda ingin membuatnya lebih dulu secara manual.

CREATE TABLE IF NOT EXISTS app_state (
    id TINYINT PRIMARY KEY,
    state LONGTEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
