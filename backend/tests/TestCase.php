<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * DNS palsu untuk OutboundHostGuard — tes integrasi (SMTP/LDAP) tidak
     * boleh bergantung pada internet.
     *
     * @param  array<string, list<string>>  $map  host => daftar IP
     */
    protected function fakeOutboundDns(array $map): void
    {
        $this->app->instance(\App\Support\OutboundHostGuard::class, new class($map) extends \App\Support\OutboundHostGuard
        {
            public function __construct(private array $map) {}

            protected function resolve(string $host): array
            {
                return $this->map[$host] ?? [];
            }
        });
    }

    //
}
