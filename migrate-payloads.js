const fs = require('fs');

const routes = [
  'e:\\opsaudit\\app\\api\\analytics-query\\route.ts',
  'e:\\opsaudit\\app\\api\\generate-report\\route.ts',
  'e:\\opsaudit\\app\\api\\generate-summary\\route.ts',
  'e:\\opsaudit\\app\\api\\generate-template\\route.ts',
  'e:\\opsaudit\\app\\api\\predict-risk\\route.ts',
  'e:\\opsaudit\\app\\api\\root-cause\\route.ts',
  'e:\\opsaudit\\app\\api\\score-quality\\route.ts',
  'e:\\opsaudit\\app\\api\\score-risk\\route.ts',
  'e:\\opsaudit\\app\\api\\verify-resolution\\route.ts'
];

for (const route of routes) {
  let content = fs.readFileSync(route, 'utf8');
  
  // Replace the model definition, system, and messages to config and contents. 
  // It looks like:
  //      model: 'gemini-3-flash',
  //      max_tokens: 300,
  //      system: `...`,
  //      messages: [{
  //        role: 'user',
  //        content: `...`
  //      }]
  
  content = content.replace(/model:\s*'gemini-3-flash',[\s\n]*max_tokens:\s*(\d+),[\s\n]*system:\s*([\s\S]*?),\s*messages:\s*\[\{\s*role:\s*'user',\s*content:\s*([\s\S]*?)\s*\}\]/, 
    "model: 'gemini-3-flash-preview',\n      config: {\n        maxOutputTokens: $1,\n        systemInstruction: $2\n      },\n      contents: $3");
    
  fs.writeFileSync(route, content, 'utf8');
}
console.log("Payloads replaced!");
