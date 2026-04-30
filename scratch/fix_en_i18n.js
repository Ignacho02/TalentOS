const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/lib/i18n/dictionaries.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix English translation which was mistakenly set to Spanish
content = content.replace(
  /en: \{\s+common: \{[^}]+searchShortcutHint: "Presiona Ctrl\+K para buscar"/,
  (match) => match.replace('Presiona Ctrl+K para buscar', 'Press Ctrl+K to search')
);

fs.writeFileSync(filePath, content);
console.log('Fixed English translation in dictionaries.ts');
