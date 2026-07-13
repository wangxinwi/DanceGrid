// Generate PWA icons from v2.0.svg
import sharp from "sharp";
import { readFileSync } from "fs";

const svgContent = readFileSync("public/v2.0.svg", "utf-8");

const sizes = [192, 512];

for (const size of sizes) {
  const svgBuffer = Buffer.from(svgContent);

  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`);

  console.log(`Generated public/icon-${size}.png`);
}

console.log("Done! PWA icons generated.");