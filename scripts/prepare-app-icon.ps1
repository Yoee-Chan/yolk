# 从 yolk-log.png 裁切内容区域，生成桌面端用的正方形图标（依赖 .NET System.Drawing）
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srcPath = Join-Path $root 'yolk-log.png'
$outDir = Join-Path $root 'build'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$src = [System.Drawing.Image]::FromFile($srcPath)
try {
    $bmp = New-Object System.Drawing.Bitmap $src
    $minX = $bmp.Width
    $minY = $bmp.Height
    $maxX = 0
    $maxY = 0
    $found = $false

    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $alpha = $bmp.GetPixel($x, $y).A
            if ($alpha -gt 10) {
                $found = $true
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if (-not $found) {
        throw "无法读取图标内容: $srcPath"
    }

    $cropW = $maxX - $minX + 1
    $cropH = $maxY - $minY + 1
    $side = [Math]::Max($cropW, $cropH)
    $pad = [int][Math]::Round($side * 0.06)
    $canvasSize = $side + ($pad * 2)

    $canvas = New-Object System.Drawing.Bitmap $canvasSize, $canvasSize
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    try {
        $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $offsetX = [int](($canvasSize - $cropW) / 2)
        $offsetY = [int](($canvasSize - $cropH) / 2)
        $srcRect = New-Object System.Drawing.Rectangle $minX, $minY, $cropW, $cropH
        $destRect = New-Object System.Drawing.Rectangle $offsetX, $offsetY, $cropW, $cropH
        $graphics.DrawImage($bmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    }
    finally {
        $graphics.Dispose()
    }

    function Save-SquareIcon {
        param(
            [System.Drawing.Bitmap]$Source,
            [int]$Size,
            [string]$Path
        )
        $out = New-Object System.Drawing.Bitmap $Size, $Size
        $g = [System.Drawing.Graphics]::FromImage($out)
        try {
            $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($Source, 0, 0, $Size, $Size)
        }
        finally {
            $g.Dispose()
        }
        $out.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        $out.Dispose()
        Write-Output "saved $Path"
    }

    Save-SquareIcon $canvas 256 (Join-Path $outDir 'icon-256.png')
    Save-SquareIcon $canvas 512 (Join-Path $outDir 'icon-512.png')
    Save-SquareIcon $canvas 1024 (Join-Path $outDir 'icon-1024.png')
    Save-SquareIcon $canvas 512 (Join-Path $outDir 'icon.png')
}
finally {
    $bmp.Dispose()
    $src.Dispose()
    $canvas.Dispose()
}
