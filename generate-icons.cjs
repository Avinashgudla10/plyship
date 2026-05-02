const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = process.argv[2];
if (!SOURCE) {
    console.error('Usage: node generate-icons.mjs <source-image-path>');
    process.exit(1);
}

const ANDROID_RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
};

async function generate() {
    console.log('Source image:', SOURCE);

    for (const [dir, size] of Object.entries(sizes)) {
        const outDir = path.join(ANDROID_RES, dir);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        // Generate square icon
        await sharp(SOURCE)
            .resize(size, size, { fit: 'cover' })
            .png()
            .toFile(path.join(outDir, 'ic_launcher.png'));
        console.log(`✅ ${dir}/ic_launcher.png (${size}x${size})`);

        // Generate round icon (same image, Android handles rounding via mask)
        await sharp(SOURCE)
            .resize(size, size, { fit: 'cover' })
            .png()
            .toFile(path.join(outDir, 'ic_launcher_round.png'));
        console.log(`✅ ${dir}/ic_launcher_round.png (${size}x${size})`);

        // Generate foreground icon (108dp with padding for adaptive icons)
        const fgSize = Math.round(size * 108 / 48);
        const iconSize = Math.round(fgSize * 0.66); // Icon occupies ~66% of the foreground
        const padding = Math.round((fgSize - iconSize) / 2);

        const resizedIcon = await sharp(SOURCE)
            .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer();

        await sharp({
            create: {
                width: fgSize,
                height: fgSize,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            }
        })
            .composite([{ input: resizedIcon, left: padding, top: padding }])
            .png()
            .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
        console.log(`✅ ${dir}/ic_launcher_foreground.png (${fgSize}x${fgSize})`);
    }

    // Also copy source as the resources icon
    const resDir = path.join(__dirname, 'resources');
    if (!fs.existsSync(resDir)) {
        fs.mkdirSync(resDir, { recursive: true });
    }
    await sharp(SOURCE)
        .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(path.join(resDir, 'icon.png'));
    console.log('✅ resources/icon.png (1024x1024)');

    console.log('\n🎉 All icons generated!');
}

generate().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
