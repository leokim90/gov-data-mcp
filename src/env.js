// --- .env 폴백 로더 (dotenv 미사용) ---
// 이미 설정된 환경변수는 덮어쓰지 않는다 — Claude Desktop config env 블록이 우선,
// 없을 때만 레포 루트 .env를 읽는다. 진실의 원천을 .env 하나로 축소하기 위한 장치.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DEFAULT_ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '../.env');

export function loadDotEnv(envPath = DEFAULT_ENV_PATH) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    // KEY=value 형식만 인식, 주석/빈 줄 무시
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
