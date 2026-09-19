#!/usr/bin/env node
// Проверка спрайтов слизней: имена файлов (точный регистр!), геометрия PNG и
// окна кадрирования из slimeAssets.js. Запуск: npm run check:sprites
// Подключено к `npm run build`, чтобы сломанный путь не доехал до продакшена:
// на регистрозависимом хостинге (Linux) промах по регистру = 404, а в dev-режиме
// Vite отдаёт SPA-fallback (200 text/html) и <img> молча падает в onerror.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANIMATIONS,
  SHEET_CELL,
  SHEET_ROWS,
  SLIMES,
  sheetUrl,
} from "../src/components/ui/slimeAssets.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_PREFIX = "/assets/sprites/";

function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("файл не является PNG");
  }
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("в PNG нет заголовка IHDR");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const problems = [];
const checked = [];

for (const [slimeId, slime] of Object.entries(SLIMES)) {
  const dir = path.join(root, "public", "assets", "sprites", slime.dir);
  let entries;
  try {
    entries = new Set(readdirSync(dir));
  } catch {
    problems.push(`${slime.dir}: папки нет (${path.relative(root, dir)})`);
    continue;
  }

  for (const [anim, def] of Object.entries(ANIMATIONS)) {
    const file = `${slime.prefix}_${def.file}_with_shadow.png`;
    const url = sheetUrl(Number(slimeId), anim);
    const rel = `${slime.dir}/${file}`;

    if (!entries.has(file)) {
      const hint = entries.has(file.toLowerCase())
        ? " — на диске другое имя (регистр!), но на деле это тот же файл: на Linux будет 404"
        : "";
      problems.push(`${rel}: файла нет. Проверьте slimeAssets.js${hint}`);
      continue;
    }
    if (!url.endsWith(`/${file}`)) {
      problems.push(`${url}: URL не совпадает с именем файла на диске (${file})`);
      continue;
    }

    const full = path.join(dir, file);
    if (!statSync(full).isFile()) {
      problems.push(`${rel}: это не файл`);
      continue;
    }

    let size;
    try {
      size = pngSize(full);
    } catch (err) {
      problems.push(`${rel}: ${err.message}`);
      continue;
    }

    if (size.height !== SHEET_ROWS * SHEET_CELL) {
      problems.push(
        `${rel}: высота ${size.height}px, ожидалось ${SHEET_ROWS * SHEET_CELL}px ` +
          `(${SHEET_ROWS} строк × ${SHEET_CELL}px)`,
      );
    }
    if (size.width % SHEET_CELL !== 0) {
      problems.push(`${rel}: ширина ${size.width}px не кратна кадру ${SHEET_CELL}px`);
    }
    const frames = Math.round(size.width / SHEET_CELL);
    if (frames < 2) {
      problems.push(`${rel}: ${frames} кадр(а) — анимации не будет`);
    }

    const { view } = slime;
    if (
      view.x < 0 ||
      view.y < 0 ||
      view.x + view.w > SHEET_CELL ||
      view.y + view.h > SHEET_CELL ||
      view.w <= 0 ||
      view.h <= 0
    ) {
      problems.push(
        `${rel}: окно кадрирования ${JSON.stringify(view)} выходит за кадр ${SHEET_CELL}×${SHEET_CELL}`,
      );
    }

    if (view.w % 2 !== 0 || view.h % 2 !== 0) {
      console.warn(
        `! ${rel}: окно ${view.w}×${view.h} имеет нечётную сторону — при центрировании в чётном кольце (220px) спрайт сядет на полупиксель и размылится (см. комментарий в slimeAssets.js)`,
      );
    }

    checked.push(`  slime${slimeId}/${anim.padEnd(6)} ${String(frames).padStart(2)} кадр.  ${size.width}×${size.height}  окно ${view.w}×${view.h}`);
  }
}

console.log(`Проверено листов: ${checked.length}`);
console.log(checked.join("\n"));

const declared = new Set(
  Object.values(SLIMES).flatMap((slime) =>
    Object.values(ANIMATIONS).map((def) => `${slime.dir}/${slime.prefix}_${def.file}_with_shadow.png`),
  ),
);
for (const [slimeId, slime] of Object.entries(SLIMES)) {
  const dir = path.join(root, "public", "assets", "sprites", slime.dir);
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    continue;
  }
  for (const name of entries) {
    if (name.endsWith(".png") && !declared.has(`${slime.dir}/${name}`)) {
      console.warn(`! лишний файл не объявлен в slimeAssets.js: ${slime.dir}/${name}`);
    }
  }
  void slimeId;
}
void URL_PREFIX;

if (problems.length) {
  console.error(`\nОшибки (${problems.length}):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\nOK: все пути с точным регистром, геометрия и окна кадрирования совпадают.");
