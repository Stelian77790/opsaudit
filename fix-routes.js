const fs = require('fs');
const path = require('path');

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('route.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // Check if it has the top-level Anthropic client
            if (content.match(/^const client = new Anthropic\(\)$/m) && content.includes('export async function POST')) {
                // Remove the top-level client
                content = content.replace(/^const client = new Anthropic\(\)[\r\n]+/m, '');
                
                // Add the client inside the POST function
                content = content.replace(/(export async function POST\([^)]+\)\s*\{)/, '$1\n  const client = new Anthropic()');
                
                // Add export const dynamic if missing
                if (!content.includes('export const dynamic')) {
                    // Try to insert after the last import
                    const lastImportIndex = content.lastIndexOf('import ');
                    let insertPos = 0;
                    if (lastImportIndex !== -1) {
                        const nextNewline = content.indexOf('\n', lastImportIndex);
                        insertPos = nextNewline !== -1 ? nextNewline + 1 : content.length;
                    }
                    content = content.slice(0, insertPos) + '\nexport const dynamic = \'force-dynamic\'\n' + content.slice(insertPos);
                }
                
                fs.writeFileSync(fullPath, content);
                console.log(`Fixed ${fullPath}`);
            }
        }
    }
}

processDirectory(path.join(__dirname, 'app', 'api'));
