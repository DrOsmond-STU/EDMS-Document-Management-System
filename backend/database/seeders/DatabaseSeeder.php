<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Sengaja hanya master data. Seeder bawaan Laravel memakai factory dengan
     * fake(), yang berasal dari dependensi dev — di server kita pasang
     * --no-dev, jadi memanggilnya akan menggagalkan `migrate --seed`.
     */
    public function run(): void
    {
        $this->call(MasterDataSeeder::class);
    }
}
