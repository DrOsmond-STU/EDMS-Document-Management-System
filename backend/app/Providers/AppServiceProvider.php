<?php

namespace App\Providers;

use App\Models\Document;
use App\Policies\DocumentPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(Document::class, DocumentPolicy::class);

        // Batas permintaan API: longgar untuk pemakaian normal SPA, tetapi
        // menghentikan skrip otomatis (scraping/brute force/DoS ringan).
        RateLimiter::for('api', fn (Request $request) => $request->user()
            ? Limit::perMinute(600)->by('user:'.$request->user()->id)
            : Limit::perMinute(120)->by('ip:'.$request->ip()));

        // Login: 5 percobaan/menit per akun+IP menghentikan tebak sandi satu
        // akun; 60/menit per IP menahan credential stuffing. Tidak dibatasi
        // per IP saja — satu kantor di balik satu IP publik harus tetap bisa
        // login bersamaan (mis. sesi pelatihan/demo).
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by('login:'.mb_strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(60)->by('login-ip:'.$request->ip()),
        ]);
    }
}
