// Analyze sprite sheet to find exact frame boundaries
const fs = require('fs');
const { PNG } = require('pngjs');

const data = fs.readFileSync('public/assets/sprites/my_sprite.png');
const png = PNG.sync.read(data);
const { width, height } = png;

console.log(`Image size: ${width}x${height}`);

// Find bounding boxes of non-transparent content in each row region
function findContentInRegion(startY, endY, label) {
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let hasContent = false;
  
  for (let y = startY; y < endY && y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = png.data[idx + 3];
      if (alpha > 10) { // non-transparent
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  
  if (hasContent) {
    console.log(`${label}: content bounds x=${minX}-${maxX}, y=${minY}-${maxY} (${maxX-minX+1}x${maxY-minY+1})`);
  }
  return { minX, maxX, minY, maxY };
}

// Scan for row boundaries - find horizontal gaps of transparency
console.log('\n--- Scanning for row separators (fully transparent rows) ---');
let rowStarts = [];
let inContent = false;
for (let y = 0; y < height; y++) {
  let rowHasContent = false;
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    if (png.data[idx + 3] > 10) {
      rowHasContent = true;
      break;
    }
  }
  if (rowHasContent && !inContent) {
    rowStarts.push(y);
    inContent = true;
  }
  if (!rowHasContent && inContent) {
    console.log(`Row content ends at y=${y-1}`);
    inContent = false;
  }
}
console.log('Row starts:', rowStarts);

// Scan for column boundaries within each detected row
console.log('\n--- Scanning for column separators ---');
// Check the first content row region
if (rowStarts.length > 0) {
  for (let ri = 0; ri < Math.min(rowStarts.length, 6); ri++) {
    const startY = rowStarts[ri];
    const endY = ri + 1 < rowStarts.length ? rowStarts[ri + 1] : height;
    
    // Find columns in this row
    let colStarts = [];
    let inCol = false;
    for (let x = 0; x < width; x++) {
      let colHasContent = false;
      for (let y = startY; y < endY && y < height; y++) {
        const idx = (y * width + x) * 4;
        if (png.data[idx + 3] > 10) {
          colHasContent = true;
          break;
        }
      }
      if (colHasContent && !inCol) {
        colStarts.push(x);
        inCol = true;
      }
      if (!colHasContent && inCol) {
        console.log(`  Row ${ri}: column content ends at x=${x-1} (width=${x-1-colStarts[colStarts.length-1]+1})`);
        inCol = false;
      }
    }
    console.log(`  Row ${ri} (y=${startY}-${endY}): ${colStarts.length} columns at x=[${colStarts.join(', ')}]`);
  }
}
