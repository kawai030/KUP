import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Concept } from "@/lib/concept-schema";
import type { Deck, Slide } from "@/lib/deck-schema";

/**
 * 카드뉴스 렌더러 — 검증 PoC의 SVG 렌더(sharp)를 TS로 이식. 로직·치수 동일.
 * [컨셉(브랜드) + deck(카피)] → 브랜드 템플릿 SVG → PNG(1080×1350).
 * 글자수 wrap 상한은 deck-schema SLIDE_LIMITS 와 짝(생성이 상한을 지키면 안 깨짐).
 * 추후 디자인 자유도가 필요하면 Playwright(HTML/CSS)로 승급(기술설계 4.1).
 */

type Brand = {
  name: string;
  primary: string;
  primary2: string;
  accent: string;
  light: string;
  font: string;
};

const W = 1080;
const H = 1350;
const MX = 96; // 좌우 여백

const clen = (s: string): number => [...String(s)].length;

// 단어(공백) 우선 줄바꿈, 너무 길면 글자 단위 분할
function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      const cand = line ? line + " " + w : w;
      if (clen(cand) <= maxChars) {
        line = cand;
        continue;
      }
      if (line) out.push(line);
      if (clen(w) > maxChars) {
        let chunk = "";
        for (const ch of [...w]) {
          if (clen(chunk) >= maxChars) {
            out.push(chunk);
            chunk = "";
          }
          chunk += ch;
        }
        line = chunk;
      } else {
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

function escapeXml(s: string): string {
  return String(s).replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}

function tspans(lines: string[], x: number, startY: number, lineH: number, anchor?: string): string {
  const a = anchor ? ` text-anchor="${anchor}"` : "";
  return lines
    .map((l, i) => `<tspan x="${x}" y="${startY + i * lineH}"${a}>${escapeXml(l)}</tspan>`)
    .join("");
}

function progressDots(brand: Brand, current: number, total: number): string {
  let s = "";
  const r = 8;
  const gap = 30;
  const endX = W - MX;
  for (let i = 0; i < total; i++) {
    const cx = endX - (total - 1 - i) * gap;
    const on = i === current;
    s += `<circle cx="${cx}" cy="104" r="${on ? r : r - 2}" fill="${brand.accent}" opacity="${on ? 1 : 0.3}"/>`;
  }
  return s;
}

function chrome(brand: Brand, pageNo: number, total: number): string {
  const defs = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.primary}"/>
      <stop offset="100%" stop-color="${brand.primary2}"/>
    </linearGradient>
  </defs>`;
  const bg = `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  const blobs = `
    <circle cx="940" cy="170" r="320" fill="${brand.accent}" opacity="0.10"/>
    <circle cx="120" cy="1180" r="240" fill="${brand.accent}" opacity="0.08"/>`;
  const aiLabel = `<text x="${MX}" y="112" font-family="${brand.font}" font-size="24" fill="${brand.light}" opacity="0.5">AI 생성 · 검수됨</text>`;
  const footer = `
    <text x="${MX}" y="${H - 72}" font-family="${brand.font}" font-size="30" fill="${brand.light}" opacity="0.55">${escapeXml(brand.name)}</text>
    <text x="${W - MX}" y="${H - 72}" font-family="${brand.font}" font-size="30" fill="${brand.light}" opacity="0.55" text-anchor="end">${pageNo} / ${total}</text>`;
  return defs + bg + blobs + aiLabel + progressDots(brand, pageNo - 1, total) + footer;
}

function pill(brand: Brand, x: number, y: number, text: string, fontSize: number): string {
  const w = clen(text) * (fontSize * 0.92) + 64;
  const h = fontSize + 40;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${brand.accent}"/>
    <text x="${x + w / 2}" y="${y + h / 2 + fontSize * 0.36}" font-family="${brand.font}" font-size="${fontSize}" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(text)}</text>`;
}

function slideSVG(brand: Brand, s: Slide, pageNo: number, total: number): string {
  let body = "";

  if (s.kind === "cover") {
    const titleLines = wrap(s.title, 9);
    const titleY = 560;
    body = `
      ${pill(brand, MX, 400, s.kicker, 30)}
      <text font-family="${brand.font}" font-size="104" font-weight="800" fill="${brand.light}">${tspans(titleLines, MX, titleY, 128)}</text>
      <rect x="${MX}" y="${titleY + titleLines.length * 128 - 30}" width="96" height="8" rx="4" fill="${brand.accent}"/>
      <text font-family="${brand.font}" font-size="42" fill="${brand.light}" opacity="0.82">${tspans(wrap(s.sub, 20), MX, titleY + titleLines.length * 128 + 56, 58)}</text>`;
  } else if (s.kind === "body") {
    const headLines = wrap(s.head, 13);
    body = `
      <text x="${W - 40}" y="520" font-family="${brand.font}" font-size="380" font-weight="800" fill="${brand.accent}" opacity="0.14" text-anchor="end">${escapeXml(s.index)}</text>
      <rect x="${MX}" y="430" width="84" height="84" rx="20" fill="${brand.accent}"/>
      <text x="${MX + 42}" y="490" font-family="${brand.font}" font-size="44" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(s.index)}</text>
      <text font-family="${brand.font}" font-size="70" font-weight="800" fill="${brand.light}">${tspans(headLines, MX, 640, 88)}</text>
      <rect x="${MX}" y="${640 + headLines.length * 88 - 6}" width="700" height="2" fill="${brand.light}" opacity="0.2"/>
      <text font-family="${brand.font}" font-size="46" fill="${brand.light}" opacity="0.85">${tspans(wrap(s.body, 17), MX, 640 + headLines.length * 88 + 80, 68)}</text>`;
  } else {
    const titleLines = wrap(s.title, 12);
    body = `
      <text font-family="${brand.font}" font-size="78" font-weight="800" fill="${brand.light}">${tspans(titleLines, MX, 500, 96)}</text>
      <text font-family="${brand.font}" font-size="44" fill="${brand.light}" opacity="0.85">${tspans(wrap(s.sub, 20), MX, 500 + titleLines.length * 96 + 50, 62)}</text>
      ${pill(brand, MX, 980, s.cta, 46)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${chrome(brand, pageNo, total)}${body}</svg>`;
}

export type RenderResult = { files: string[]; outDir: string };

/**
 * deck 의 모든 슬라이드를 PNG 로 렌더해 outDir 에 저장.
 * @param outDir 출력 디렉토리(기본: <cwd>/out/<conceptId>)
 */
export async function renderDeck(concept: Concept, deck: Deck, outDir?: string): Promise<RenderResult> {
  const v = concept.visual;
  const brand: Brand = {
    name: concept.account,
    primary: v.primary,
    primary2: v.primary2 ?? v.primary,
    accent: v.accent,
    light: v.light,
    font: v.font,
  };

  const dir = outDir ?? path.join(process.cwd(), "out", deck.conceptId);
  fs.mkdirSync(dir, { recursive: true });

  const total = deck.slides.length;
  const files: string[] = [];
  for (let i = 0; i < total; i++) {
    const slide = deck.slides[i];
    if (!slide) continue;
    const svg = slideSVG(brand, slide, i + 1, total);
    const file = path.join(dir, `slide_${i + 1}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    files.push(file);
  }

  return { files, outDir: dir };
}
