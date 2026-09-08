<!doctype html>
<html lang="id">
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; color: #1f2937; padding: 24px;">
    <h2 style="margin: 0 0 12px;">Pengingat Tinjauan Ulang Dokumen</h2>
    <p>Halo {{ $ownerName }},</p>
    <p>Dokumen berikut yang Anda miliki di EDMS akan/sudah jatuh tempo tinjauan ulang:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
            <tr style="text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #6b7280;">
                <th style="padding: 6px 8px;">Kode</th>
                <th style="padding: 6px 8px;">Judul</th>
                <th style="padding: 6px 8px;">Tanggal Tinjauan</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($documents as $doc)
            <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; font-family: monospace;">{{ $doc->code }}</td>
                <td style="padding: 6px 8px;">{{ $doc->title }}</td>
                <td style="padding: 6px 8px;">{{ $doc->review_date?->format('d-m-Y') ?? '—' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    <p>Mohon segera ditindaklanjuti lewat EDMS.</p>
    <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Email otomatis dari sistem EDMS — jangan balas email ini.</p>
</body>
</html>
