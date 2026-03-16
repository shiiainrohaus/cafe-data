/**
 * extract.ts
 *
 * Reads raw text from the Coffee Salon Yearbook (or any source text),
 * sends it to Claude API, and outputs structured product JSON
 * into data/review-queue/ for human review before DB import.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=xxx tsx scripts/extract.ts --input ./data/raw/yearbook-p42.txt
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a coffee equipment data extractor.
Given raw text from a professional coffee publication, extract ALL equipment/products mentioned.
For each product, output a JSON object with these fields:
{
  "brand": "string",
  "name": "string",
  "category": "grinder|espresso_machine|brewer|kettle|scale|accessory|other",
  "subcategory": "string or null",
  "specs": {
    // include any specs mentioned: burr size, material, capacity, power, etc.
  },
  "priceMin": number or null,
  "priceMax": number or null,
  "priceCurrency": "USD|CNY|EUR or null",
  "countryOfOrigin": "string or null",
  "availableInCn": true|false|null,
  "sourceNote": "exact page or section reference",
  "rawExcerpt": "the original sentence(s) from the source text"
}

Return a JSON array of all products found. If a field is unknown, use null.
Be conservative — only include what is explicitly stated in the text.`;

async function extractProducts(inputText: string): Promise<object[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Extract all coffee equipment products from this text:\n\n${inputText}`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  // Strip markdown code fences if present
  const json = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(json);
}

async function main() {
  const args = process.argv.slice(2);
  const inputFlag = args.indexOf('--input');
  if (inputFlag === -1 || !args[inputFlag + 1]) {
    console.error('Usage: tsx scripts/extract.ts --input <path-to-text-file>');
    process.exit(1);
  }

  const inputPath = args[inputFlag + 1];
  const inputText = fs.readFileSync(inputPath, 'utf-8');

  console.log(`📖 Reading from: ${inputPath}`);
  console.log('🤖 Sending to Claude for extraction...');

  const products = await extractProducts(inputText);

  console.log(`✅ Extracted ${products.length} products`);

  // Write to review queue
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join('data/review-queue', `extracted-${timestamp}.json`);

  fs.mkdirSync('data/review-queue', { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));

  console.log(`📁 Saved to: ${outputFile}`);
  console.log('👀 Review the file, edit as needed, then run: tsx scripts/seed.ts --input ' + outputFile);
}

main().catch(console.error);
