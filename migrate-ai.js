const fs = require('fs');
const path = require('path');

const routes = [
  'e:\\opsaudit\\app\\api\\analyse-photo\\route.ts',
  'e:\\opsaudit\\app\\api\\analyse-sop\\route.ts',
  'e:\\opsaudit\\app\\api\\analytics-query\\route.ts',
  'e:\\opsaudit\\app\\api\\audit-copilot\\route.ts',
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
  
  if (content.includes('@anthropic-ai/sdk')) {
    // 1. Swap imports
    content = content.replace("import Anthropic from '@anthropic-ai/sdk'", "import { GoogleGenAI } from '@google/genai'");
    
    // 2. Swap Auth
    content = content.replace("const client = new Anthropic()", "const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })");
    
    // 3. Swap message definitions specifically in audit-copilot.ts and analyse-sop.ts
    content = content.replace("Anthropic.MessageParam[]", "any[]"); 
    content = content.replace("Anthropic.MessageParam['content']", "any[]"); 
    
    // 4. Update the creation calls
    // Usually it looks like:
    // const response = await client.messages.create({
    //   model: 'claude-opus-4-6',
    //   max_tokens: ...,
    //   system: ...,
    //   messages: ...
    // })
    
    // Replace the basic call wrapper
    content = content.replace(/client\.messages\.create\s*\(\s*\{/g, "ai.models.generateContent({");
    
    // Replace max_tokens -> maxOutputTokens (needs to be inside config)
    // First, let's just make it naive: we will regex out system, max_tokens, messages, model.
    // This is hard to do safely with pure regex because of nesting. Let's do it semi-manually where needed or using some clever regex for the properties.
    content = content.replace(/model:\s*'claude-opus-4-6',/g, "model: 'gemini-3-flash',");
    content = content.replace(/model:\s*"claude-opus-4-6",/g, "model: 'gemini-3-flash',");
    
    // Convert response parsing
    //  response.content[0].type === 'text' ? response.content[0].text : ''
    content = content.replace(/response\.content\[0\]\.type\s*===\s*'text'\s*\?\s*response\.content\[0\]\.text\s*:\s*''/g, "(response.text || '')");
    content = content.replace(/response\.content\[0\]\.type\s*===\s*"text"\s*\?\s*response\.content\[0\]\.text\s*:\s*""/g, "(response.text || '')");
    
    fs.writeFileSync(route, content, 'utf8');
  }
}

console.log("Basic migration done. Manual fixups for config/messages might be needed.");
