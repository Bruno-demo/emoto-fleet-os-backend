const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  if (dir.includes('node_modules') || dir.includes('.next')) return;
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const targetDir = path.join(process.cwd(), 'apps', 'dashboard');

walk(targetDir, (filePath) => {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Normalize select backgrounds to surface-hover
    content = content.replace(/<select([^>]+)bg-(?:background|surface|white\/5|\[#121214\])/g, '<select$1bg-surface-hover');
    
    // Ensure text-ink is used
    content = content.replace(/<select([^>]+)text-(?:zinc-300|white|ink-muted)/g, '<select$1text-ink');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Normalized Selects in: ${filePath}`);
    }
  }
});
