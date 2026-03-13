
import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');

let newContent = content
  .replace(/#015958/g, '#1e3a8a') // Dark Blue
  .replace(/#0FC2C0/g, '#3b82f6') // Blue
  .replace(/#008F8C/g, '#2563eb') // Blue
  .replace(/#023535/g, '#0a0918') // Darkest Blue
  .replace(/emerald/g, 'blue')
  .replace(/teal/g, 'blue');

fs.writeFileSync('src/App.tsx', newContent);
