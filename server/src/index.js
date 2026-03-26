import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { calculateTargets } from './lib/nutrition.js';
import { groqChat } from './lib/groq.js';
import { getIndiaFoodSuggestions, normalizeKey } from './lib/indiaFoods.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST']
});

app.get('/health', async () => ({ ok: true }));

app.post('/api/targets', async (request, reply) => {
  try {
    const data = request.body ?? {};
    const result = calculateTargets(data);
    return result;
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({ error: err.message ?? 'Invalid input' });
  }
});

app.post('/api/ai/plan', async (request, reply) => {
  try {
    const data = request.body ?? {};
    const content = await groqChat({
      system: 'You are a precise fitness nutrition coach. Give short, actionable guidance. Do not give medical advice.',
      user: buildPlanPrompt(data)
    });

    return { plan: content };
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'AI request failed' });
  }
});

app.post('/api/ai/agent', async (request, reply) => {
  try {
    const { goal, context } = request.body ?? {};
    const content = await groqChat({
      system:
        'You are a fitness planning agent. Return JSON only with summary, steps, questions, and a short meal plan. Keep steps actionable and short.',
      user: [
        'User goal:',
        goal || 'unknown',
        '',
        'Context:',
        context || 'none',
        '',
        'Return JSON with keys:',
        'summary (string), steps (array of strings), questions (array of strings), meal_plan (array of short meal strings).',
        'No extra text.'
      ].join('\\n'),
      responseFormat: { type: 'json_object' }
    });

    const parsed = safeJsonParse(content);
    if (!parsed) {
      return reply.status(502).send({ error: 'Invalid AI response' });
    }

    return {
      summary: parsed.summary || '',
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      meal_plan: Array.isArray(parsed.meal_plan) ? parsed.meal_plan : []
    };
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'AI request failed' });
  }
});

app.post('/api/region/cuisines', async (request, reply) => {
  try {
    const data = request.body ?? {};
    const suggestions = await suggestCuisines(data);
    return suggestions;
  } catch (err) {
    request.log.error(err);
    return reply.status(400).send({ error: err.message ?? 'Invalid input' });
  }
});

app.post('/api/region/reverse', async (request, reply) => {
  try {
    const { lat, lon } = request.body ?? {};
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return reply.status(400).send({ error: 'lat and lon are required numbers' });
    }

    const location = await reverseGeocodeNominatim({ lat, lon });
    return { location };
  } catch (err) {
    request.log.error(err);
    return reply.status(502).send({ error: 'Reverse geocoding failed' });
  }
});

app.post('/api/ai/meal', async (request, reply) => {
  try {
    const { text } = request.body ?? {};
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ error: 'text is required' });
    }

    const deterministic = await estimateMealDeterministic(text);
    if (deterministic) {
      return deterministic;
    }

    const content = await groqChat({
      system: 'You estimate nutrition for described meals. Return JSON only.',
      user: buildMealPrompt(text),
      responseFormat: { type: 'json_object' }
    });

    const parsed = safeJsonParse(content);
    if (!parsed) {
      return reply.status(502).send({ error: 'Invalid AI response' });
    }

    const normalized = normalizeMealEstimate(parsed);
    if (!normalized) {
      return reply.status(502).send({ error: 'Invalid AI response' });
    }

    return normalized;
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message || 'AI request failed' });
  }
});

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

app.listen({ port, host });

function buildPlanPrompt(data) {
  const {
    age,
    sex,
    heightCm,
    weightKg,
    activityLevel,
    goal,
    fastingHours,
    eatingWindowHours,
    eatingWindowStart,
    eatingWindowEnd,
    preferences,
    region,
    state,
    city
  } = data;

  return [
    'User profile:',
    `- Age: ${age ?? 'unknown'}`,
    `- Sex: ${sex ?? 'unknown'}`,
    `- Height: ${heightCm ?? 'unknown'} cm`,
    `- Weight: ${weightKg ?? 'unknown'} kg`,
    `- Activity level: ${activityLevel ?? 'unknown'}`,
    `- Goal: ${goal ?? 'unknown'}`,
    `- Fasting: ${fastingHours ?? 'unknown'} hours fasting`,
    `- Eating window: ${eatingWindowHours ?? 'unknown'} hours`,
    `- Eating window time: ${eatingWindowStart ?? 'unknown'} to ${eatingWindowEnd ?? 'unknown'}`,
    `- Preferences: ${preferences ?? 'none'}`,
    `- Region: ${region ?? 'unknown'}, State: ${state ?? 'unknown'}, City: ${city ?? 'unknown'} (use hyper-local foods)`,
    '',
    'Give:',
    '1) Daily calorie target and macros.',
    '2) A sample 1-day meal plan that fits the eating window and region.',
    '3) 3 quick tips for gym performance and leanness.',
    'Keep it under 220 words.'
  ].join('\n');
}

async function suggestCuisines({ region, state, city }) {
  const regionNorm = (region || '').trim().toLowerCase();
  const stateNorm = (state || '').trim().toLowerCase();
  const cityNorm = (city || '').trim().toLowerCase();

  if (regionNorm === 'india') {
    const india = getIndiaFoodSuggestions({ state: stateNorm, city: cityNorm });
    if (india) {
      if ((!india.cuisines || !india.cuisines.length) && (!india.specialties || !india.specialties.length)) {
        const aiFallback = await aiCuisineFallback({ region, state, city });
        return aiFallback || { cuisines: ['Indian', 'Regional home-style'], specialties: [] };
      }
      return { cuisines: india.cuisines, specialties: india.specialties };
    }

    const fallback = ['Indian', 'Regional home-style'];
    const aiFallback = await aiCuisineFallback({ region, state, city });
    return aiFallback || { cuisines: fallback, specialties: [] };
  }

  if (regionNorm === 'usa' || regionNorm === 'us' || regionNorm === 'united states') {
    return { cuisines: ['American', 'Mediterranean', 'Mexican', 'High-protein bowls'], specialties: [] };
  }

  if (regionNorm === 'uk' || regionNorm === 'united kingdom') {
    return { cuisines: ['British', 'Mediterranean', 'Middle Eastern'], specialties: [] };
  }

  if (regionNorm === 'uae' || regionNorm === 'united arab emirates') {
    return { cuisines: ['Middle Eastern', 'Levantine', 'South Asian'], specialties: [] };
  }

  const generic = { cuisines: ['Local home-style', 'High-protein', 'Whole foods'], specialties: [] };
  const aiFallback = await aiCuisineFallback({ region, state, city });
  return aiFallback || generic;
}

async function aiCuisineFallback({ region, state, city }) {
  if (!region && !state && !city) return null;
  try {
    const content = await groqChat({
      system: 'You suggest local cuisines and specialties for a place. Return JSON only.',
      user: [
        'Location:',
        `Region/Country: ${region || 'unknown'}`,
        `State/Province: ${state || 'unknown'}`,
        `City: ${city || 'unknown'}`,
        '',
        'Return JSON with keys:',
        'cuisines (array of short strings), specialties (array of short dish/ingredient names).',
        'No extra text.'
      ].join('\\n'),
      responseFormat: { type: 'json_object' }
    });
    const parsed = safeJsonParse(content);
    if (!parsed || !Array.isArray(parsed.cuisines)) return null;
    return {
      cuisines: parsed.cuisines.slice(0, 6),
      specialties: Array.isArray(parsed.specialties) ? parsed.specialties.slice(0, 8) : []
    };
  } catch {
    return null;
  }
}

async function reverseGeocodeNominatim({ lat, lon }) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CalorieFit/0.1 (reverse geocode)',
      'Accept-Language': 'en'
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim error ${response.status}`);
  }

  const data = await response.json();
  const address = data.address || {};

  return {
    region: address.country || null,
    state: address.state || address.region || null,
    city: address.city || address.town || address.village || address.county || null
  };
}

function buildMealPrompt(text) {
  return [
    'Estimate calories and macros for this meal:',
    text,
    '',
    'Return JSON with keys:',
    'items (array of {name, quantity, unit, calories, protein_g, carbs_g, fat_g}),',
    'total_calories, total_protein_g, total_carbs_g, total_fat_g, confidence (0-1).',
    'If multiple foods are listed, split them into separate items.',
    'All macros and calories must reflect the full quantity specified.',
    'No extra text.'
  ].join('\n');
}

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch {
    const match = input.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeMealEstimate(input) {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) return null;

  const normItems = items
    .map((item) => ({
      name: String(item.name || 'Item'),
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      calories: toNumber(item.calories),
      protein_g: toNumber(item.protein_g),
      carbs_g: toNumber(item.carbs_g),
      fat_g: toNumber(item.fat_g)
    }))
    .filter((item) => item.calories !== null);

  if (!normItems.length) return null;

  const totals = normItems.reduce(
    (acc, item) => {
      acc.calories += item.calories || 0;
      acc.protein_g += item.protein_g || 0;
      acc.carbs_g += item.carbs_g || 0;
      acc.fat_g += item.fat_g || 0;
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return finalizeMealEstimate(normItems, clamp01(toNumber(input.confidence) ?? 0.5));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round(value) {
  return Math.round(value);
}

function roundTo(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finalizeMealEstimate(items, confidence = 0.6) {
  const totals = items.reduce(
    (acc, item) => {
      acc.calories += item.calories || 0;
      acc.protein_g += item.protein_g || 0;
      acc.carbs_g += item.carbs_g || 0;
      acc.fat_g += item.fat_g || 0;
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return {
    items,
    total_calories: Math.round(totals.calories),
    total_protein_g: roundTo(totals.protein_g),
    total_carbs_g: roundTo(totals.carbs_g),
    total_fat_g: roundTo(totals.fat_g),
    confidence: clamp01(confidence)
  };
}

async function estimateMealDeterministic(text) {
  const parsed = parseMealText(text);
  if (!parsed.length) return null;

  const knownItems = [];
  const unknownItems = [];

  for (const item of parsed) {
    const estimate = estimateItemFromMap(item);
    if (estimate) {
      knownItems.push(estimate);
    } else {
      unknownItems.push(item.raw);
    }
  }

  if (unknownItems.length === 0 && knownItems.length) {
    return finalizeMealEstimate(knownItems, 0.75);
  }

  // If some items are known, try AI on the remaining unknowns and merge.
  if (unknownItems.length && knownItems.length) {
    return await estimateUnknownItemsWithAi(unknownItems.join(', '), knownItems);
  }

  return null;
}

async function estimateUnknownItemsWithAi(text, knownItems) {
  const content = await groqChat({
    system: 'You estimate nutrition for described meals. Return JSON only.',
    user: buildMealPrompt(text),
    responseFormat: { type: 'json_object' }
  });

  const parsed = safeJsonParse(content);
  if (!parsed) return finalizeMealEstimate(knownItems, 0.55);

  const normalized = normalizeMealEstimate(parsed);
  if (!normalized || !Array.isArray(normalized.items)) return finalizeMealEstimate(knownItems, 0.55);

  const merged = [...knownItems, ...normalized.items];
  return finalizeMealEstimate(merged, Math.min(normalized.confidence ?? 0.6, 0.7));
}

function parseMealText(text) {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const gramsMatch = raw.match(/(\d+(?:\.\d+)?)\s*(g|gm|grams)\b/i);
      const pieceMatch = raw.match(/(\d+(?:\.\d+)?)\s*(piece|pieces|pcs|pc)\b/i);
      const countMatch = raw.match(/^(\d+(?:\.\d+)?)\s+/);

      let quantity = null;
      let unit = null;

      if (gramsMatch) {
        quantity = Number(gramsMatch[1]);
        unit = 'g';
      } else if (pieceMatch) {
        quantity = Number(pieceMatch[1]);
        unit = 'piece';
      } else if (countMatch) {
        quantity = Number(countMatch[1]);
        unit = 'piece';
      }

      const name = raw
        .replace(/(\d+(?:\.\d+)?)\s*(g|gm|grams|piece|pieces|pcs|pc)\b/gi, '')
        .replace(/^\d+(?:\.\d+)?\s+/, '')
        .trim()
        .toLowerCase();

      return { raw, name, quantity, unit };
    });
}

function estimateItemFromMap({ name, quantity, unit, raw }) {
  if (!name) return null;
  const key = name.replace(/[^\w\s]/g, '').trim();

  const map = {
    rice: { per100g: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3 } },
    'cooked rice': { per100g: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3 } },
    grapes: { per100g: { calories: 69, protein_g: 0.7, carbs_g: 18.1, fat_g: 0.2 } },
    'green grapes': { per100g: { calories: 69, protein_g: 0.7, carbs_g: 18.1, fat_g: 0.2 } },
    obattu: { perPiece: { calories: 280, protein_g: 5, carbs_g: 35, fat_g: 10 } },
    holige: { perPiece: { calories: 280, protein_g: 5, carbs_g: 35, fat_g: 10 } },
    'puran poli': { perPiece: { calories: 280, protein_g: 5, carbs_g: 35, fat_g: 10 } }
  };

  const matchKey = Object.keys(map).find((k) => key === k || key.includes(k));
  if (!matchKey) return null;

  const entry = map[matchKey];
  if (!quantity || !unit) return null;

  if (unit === 'g' && entry.per100g) {
    const factor = quantity / 100;
    return {
      name: matchKey,
      quantity,
      unit: 'g',
      calories: roundTo(entry.per100g.calories * factor),
      protein_g: roundTo(entry.per100g.protein_g * factor),
      carbs_g: roundTo(entry.per100g.carbs_g * factor),
      fat_g: roundTo(entry.per100g.fat_g * factor)
    };
  }

  if (unit === 'piece' && entry.perPiece) {
    return {
      name: matchKey,
      quantity,
      unit: 'piece',
      calories: roundTo(entry.perPiece.calories * quantity),
      protein_g: roundTo(entry.perPiece.protein_g * quantity),
      carbs_g: roundTo(entry.perPiece.carbs_g * quantity),
      fat_g: roundTo(entry.perPiece.fat_g * quantity)
    };
  }

  return null;
}
