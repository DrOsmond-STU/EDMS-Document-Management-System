<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrgFunction;
use App\Models\Standard;
use Illuminate\Http\JsonResponse;

class MasterDataController extends Controller
{
    /** Data acuan untuk dropdown formulir — fungsi & standar aktif saja. */
    public function index(): JsonResponse
    {
        return response()->json([
            'functions' => OrgFunction::where('active', true)->orderBy('name')->get(['id', 'name']),
            'standards' => Standard::where('active', true)->orderBy('code')->get(['code', 'name']),
        ]);
    }
}
