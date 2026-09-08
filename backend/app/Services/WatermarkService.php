<?php

namespace App\Services;

use setasign\Fpdi\Tcpdf\Fpdi;

/**
 * Menempel watermark "UNCONTROLLED COPY" SUNGGUHAN ke dalam berkas —
 * bukan lapisan CSS di layar — supaya ikut terbawa kalau dicetak atau
 * di-print-to-PDF lewat penampil bawaan browser. Hanya PDF & gambar yang
 * didukung: format Office (docx/xlsx/pptx) butuh LibreOffice untuk
 * diwatermark andal, yang tidak tersedia di hosting bersama ini — makanya
 * dokumen terkontrol diwajibkan PDF sebelum dirilis (lihat
 * DocumentLifecycle::assertReadyForRelease).
 */
class WatermarkService
{
    private const TEXT = 'UNCONTROLLED COPY';

    private const WATERMARKABLE_MIMES = ['application/pdf', 'image/png', 'image/jpeg'];

    public function isWatermarkable(string $mimeType): bool
    {
        return in_array($mimeType, self::WATERMARKABLE_MIMES, true);
    }

    /** @return array{content: string, mime: string} */
    public function watermark(string $absolutePath, string $mimeType): array
    {
        return match ($mimeType) {
            'application/pdf' => ['content' => $this->watermarkPdf($absolutePath), 'mime' => 'application/pdf'],
            'image/png' => ['content' => $this->watermarkImage($absolutePath, 'png'), 'mime' => 'image/png'],
            'image/jpeg' => ['content' => $this->watermarkImage($absolutePath, 'jpeg'), 'mime' => 'image/jpeg'],
            default => throw new \RuntimeException("Format \"{$mimeType}\" tidak didukung untuk pratinjau berwatermark."),
        };
    }

    private function watermarkPdf(string $path): string
    {
        $pdf = new Fpdi();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);

        $pageCount = $pdf->setSourceFile($path);

        for ($i = 1; $i <= $pageCount; $i++) {
            $templateId = $pdf->importPage($i);
            $size = $pdf->getTemplateSize($templateId);
            $orientation = $size['width'] > $size['height'] ? 'L' : 'P';

            $pdf->AddPage($orientation, [$size['width'], $size['height']]);
            $pdf->useTemplate($templateId);

            $this->tileText($pdf, $size['width'], $size['height']);
        }

        return $pdf->Output('', 'S');
    }

    private function tileText(Fpdi $pdf, float $width, float $height): void
    {
        $pdf->SetFont('helvetica', 'B', 28);
        $pdf->SetTextColor(190, 40, 40);

        $stepX = 90;
        $stepY = 55;

        for ($y = -20; $y < $height + $stepY; $y += $stepY) {
            for ($x = -40; $x < $width + $stepX; $x += $stepX) {
                $pdf->StartTransform();
                $pdf->Rotate(45, $x, $y);
                // SetAlpha ada di dalam Start/StopTransform supaya transparansi
                // tidak bocor ke elemen lain di halaman.
                $pdf->SetAlpha(0.18);
                $pdf->Text($x, $y, self::TEXT);
                $pdf->StopTransform();
            }
        }
    }

    private function watermarkImage(string $path, string $type): string
    {
        $image = $type === 'png' ? imagecreatefrompng($path) : imagecreatefromjpeg($path);
        if (! $image) {
            throw new \RuntimeException('Gagal membaca berkas gambar untuk diwatermark.');
        }

        imagesavealpha($image, true);
        imagealphablending($image, true);

        $width = imagesx($image);
        $height = imagesy($image);
        $color = imagecolorallocatealpha($image, 190, 40, 40, 100); // merah, cukup transparan
        $font = resource_path('fonts/watermark-bold.ttf');
        $fontSize = max(14, (int) round(min($width, $height) / 12));

        $stepX = $fontSize * 9;
        $stepY = $fontSize * 5;

        for ($y = 0; $y < $height + $stepY; $y += $stepY) {
            for ($x = -$stepX; $x < $width + $stepX; $x += $stepX) {
                imagettftext($image, $fontSize, 30, $x, $y, $color, $font, self::TEXT);
            }
        }

        ob_start();
        if ($type === 'png') {
            imagepng($image);
        } else {
            imagejpeg($image, null, 90);
        }
        $content = ob_get_clean();
        imagedestroy($image);

        return $content;
    }
}
