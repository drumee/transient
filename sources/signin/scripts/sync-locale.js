#!/usr/bin/env node

/**
 * Sync signin locale keys to drumee.in locale management system
 *
 * Usage: node scripts/sync-locale.js
 *
 * Signin locale files use flat key-value JSON (all keys are LOCALE keys directly).
 * Category: "ui"
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://drumee.in/-/svc';
const CATEGORY = 'ui';
const LANGUAGES = ['en', 'fr', 'es', 'km', 'ru', 'zh'];
const LOCALE_DIR = path.resolve(__dirname, '../src/locale');

const COOKIE = 'regsid=SaHdSLr6HX0pKZlUJG50h2C0jc';
const SOCKET_ID = 'OV7Pw+akQpxyArK9mh5Mbg==';
const DEVICE_ID = 'ddi_OV7Pw4akQpxyArK9mh5Mbg44';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Cookie': COOKIE,
  'Origin': 'https://drumee.in',
  'Referer': 'https://drumee.in/-/',
  'x-param-device': 'desktop',
  'x-param-device-id': DEVICE_ID,
  'x-param-keysel': 'regsid',
  'x-param-lang': 'en',
  'x-param-page-language': 'en',
};

function readLocaleFiles() {
  const locales = {};
  for (const lang of LANGUAGES) {
    const filePath = path.join(LOCALE_DIR, `${lang}.json`);
    if (fs.existsSync(filePath)) {
      locales[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }
  return locales;
}

function buildKeyMap(locales) {
  const en = locales.en || {};
  const keyMap = {};
  for (const key of Object.keys(en)) {
    keyMap[key] = {};
    for (const lang of LANGUAGES) {
      keyMap[key][lang] = (locales[lang] && locales[lang][key]) || '';
    }
  }
  return keyMap;
}

async function apiPost(service, body) {
  const url = `${BASE_URL}/${service}`;
  const payload = { socket_id: SOCKET_ID, device_id: DEVICE_ID, ...body };
  const res = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${json.error}: ${json.reason || ''}`);
  return json.data !== undefined ? json.data : json;
}

async function getExistingKey(key) {
  try {
    const data = await apiPost('locale.get', { key, category: CATEGORY });
    if (data && Array.isArray(data) && data.length > 0) return data;
    return null;
  } catch { return null; }
}

async function addLocaleKey(keyCode, values) {
  const payload = { key_code: keyCode, ...values };
  return apiPost('locale.add', { values: payload, category: CATEGORY });
}

async function updateLocaleEntry(id, value) {
  return apiPost('locale.update', { id, value });
}

async function main() {
  console.log('Reading locale files...');
  const locales = readLocaleFiles();

  console.log('Building key map...');
  const keyMap = buildKeyMap(locales);
  const keys = Object.keys(keyMap);
  console.log(`Found ${keys.length} keys to sync.\n`);

  let created = 0, updated = 0, unchanged = 0, errors = 0;

  for (const key of keys) {
    const values = keyMap[key];
    process.stdout.write(`  ${key} ... `);

    try {
      const existing = await getExistingKey(key);

      if (!existing) {
        await addLocaleKey(key, values);
        console.log('CREATED');
        created++;
      } else {
        let langUpdated = 0;
        for (const entry of existing) {
          const lang = entry.lng;
          const newValue = values[lang];
          if (newValue !== undefined && newValue !== '' && newValue !== entry.des) {
            await updateLocaleEntry(entry.id, newValue);
            langUpdated++;
          }
        }
        const existingLangs = new Set(existing.map(e => e.lng));
        for (const lang of LANGUAGES) {
          if (!existingLangs.has(lang) && values[lang]) {
            await apiPost('locale.update', { code: key, lang, value: values[lang], category: CATEGORY });
            langUpdated++;
          }
        }
        if (langUpdated > 0) {
          console.log(`UPDATED (${langUpdated} lang${langUpdated > 1 ? 's' : ''})`);
          updated++;
        } else {
          console.log('UNCHANGED');
          unchanged++;
        }
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total keys: ${keys.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Errors: ${errors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
