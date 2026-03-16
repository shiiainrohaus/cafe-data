/**
 * extract.ts
 *
 * Reads raw text OR processes images from the Coffee Salon Yearbook,
 * sends to Claude API, and outputs structured product JSON
 * into data/review-queue/ for human review before DB import.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=xxx tsx scripts/extract.ts --input ./data/raw/yearbook-p42.txt
 *   ANTHROPIC_API_KEY=xxx tsx scripts/extract.ts --input ./data/raw/page.jpg
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a coffee equipment data extractor for a structured product database.
Given text or images from a professional coffee publication, extract ALL equipment/products mentioned.

For each product output a JSON object with these exact fields:

{
  "brand": "string — brand name",
  "name": "string — product model name",
  "category": "grinder | espresso_machine | brewer | kettle | scale | accessory | other",
  "subcategory": "string or null — e.g. hand grinder, pour over dripper, electric gooseneck kettle",
  "modelNumber": "string or null — official SKU/model code if mentioned",
  "yearIntroduced": number or null,
  "status": "current | discontinued | limited_edition | prototype — default current",
  "specs": {
    // Include ALL technical specs mentioned. Keys in English, values as-is.
    // Grinders: burr_size_mm, burr_type, burr_material, adjustment_increment_mm, motor_type, power_w, anti_static, single_dose_capable, weight_g
    // Espresso machines: boiler_type, pump_type, brew_pressure_bar, pid_controller, portafilter_mm, water_tank_ml, power_w
    // Drippers: shape, rib_design, material, filter_type, bypass_control, immersion_capable
    // Kettles: capacity_ml, power_w, temperature_control, hold_duration_min, handle_material
  },
  "priceMin": number or null,
  "priceMax": number or null,
  "priceCurrency": "USD | CNY | EUR or null",
  "priceCnMin": number or null,
  "priceCnMax": number or null,
  "countryOfOrigin": "string or null",
  "availableInCn": true | false | null,
  "cnDistributor": "string or null — CN distributor name if mentioned",
  "competitionUsage": [
    {
      "competitionName": "e.g. WBC 2024",
      "competitionYear": number or null,
      "competitorName": "string or null",
      "competitorCountry": "string or null",
      "placement": "string or null — 1st, finalist, etc.",
      "role": "grinder | espresso_machine | brewer | other"
    }
  ],
  "reviewMentions": [
    {
      "sourceType": "youtube | bilibili | reddit | blog | magazine",
      "authorName": "string — reviewer/channel name",
      "contentLocale": "zh | en | ja"
    }
  ],
  "tags": ["award-winner", "wbc-used", "cn-exclusive", "limited-edition", "collab", "beginner-friendly", "prosumer", "travel"],
  "sourceNote": "exact page or section reference e.g. Coffee Salon Annual 2025, p.94",
  "rawExcerpt": "the original sentence(s) from the source — use straight ASCII double quotes only, never curly quotes"
}

Rules:
- Return a valid JSON array of all products found. No markdown, no code fences.
- Use null for any unknown field — never omit fields.
- competitionUsage and reviewMentions default to empty arrays [] if nothing mentioned.
- tags default to empty array [] if nothing matches.
- In rawExcerpt, replace any curly/smart quotes (" " ' ') with straight quotes (" ').
- Be conservative: only include what is explicitly stated in the source.`;

function sanitizeJson(raw: string): string {
  // Strip markdown code fences
  let s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  // Replace curly/smart quotes that could break JSON parsing
  s = s
    .replace(/\u201c/g, '\\"').replace(/\u201d/g, '\\"')  // " "
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'");       // ' '
  return s;
}

async function extractFromText(inputText: string): Promise<object[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Extract all coffee equipment products from this text:\n\n${inputText}` }],
  });
  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');
  return JSON.parse(sanitizeJson(content.text));
}

async function extractFromImage(imagePath: string): Promise<object[]> {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: 'Extract all coffee equipment products visible in this image.' },
      ],
    }],
  });
  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');
  return JSON.parse(sanitizeJson(content.text));
}

async function main() {
  const args = process.argv.slice(2);
  const inputFlag = args.indexOf('--input');

  if (inputFlag === -1 || !args[inputFlag + 1]) {
    console.error('Usage: tsx scripts/extract.ts --input <text-file-or-image>');
    process.exit(1);
  }

  const inputPath = args[inputFlag + 1];
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const ext = path.extname(inputPath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

  console.log(`📖 Input: ${inputPath} (${isImage ? 'image' : 'text'})`);
  console.log('🤖 Sending to Claude...');

  const products = isImage
    ? await extractFromImage(inputPath)
    : await extractFromText(fs.readFileSync(inputPath, 'utf-8'));

  console.log(`✅ Extracted ${products.length} products`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join('data/review-queue', `extracted-${timestamp}.json`);
  fs.mkdirSync('data/review-queue', { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));

  console.log(`📁 Saved to: ${outputFile}`);
  console.log(`👀 Review, edit as needed, then run:`);
  console.log(`   node scripts/seed-v2.js --input ${outputFile}`);
}

main().catch(console.error);
