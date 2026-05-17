const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const targetDir = path.join(process.cwd(), 'apps', 'dashboard');

walk(targetDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    content = content.replace(/bg-\[#121214\]/g, 'bg-surface-strong');
    content = content.replace(/border-white\/5/g, 'border-line');
    content = content.replace(/text-zinc-300/g, 'text-ink-soft');
    content = content.replace(/bg-\[#1e1a12\]/g, 'bg-warning-soft');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  }
});
