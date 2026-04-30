const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/lib/i18n/dictionaries.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Add Spanish translation
content = content.replace(
  /no: "No",\s+\},/g,
  'no: "No",\n      searchShortcutHint: "Presiona Ctrl+K para buscar",\n    },'
);

// Add English translation (note: English might have different spacing or "No", vs "No" depending on how it's written)
content = content.replace(
  /no: "No",\n    },/g, 
  'no: "No",\n      searchShortcutHint: "Press Ctrl+K to search",\n    },'
);

fs.writeFileSync(filePath, content);
console.log('Updated dictionaries.ts');
