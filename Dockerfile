# --- gov-data-mcp HTTP 서버 (원격 배포용) ---
# 필요 env: DATA_GO_KR_SERVICE_KEY, (선택) BIZINFO_API_KEY/SMES_API_KEY, AUTH_TOKEN, (선택) PORT
FROM node:20-alpine

WORKDIR /app

# 의존성 먼저 복사해 레이어 캐시 활용
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "src/http-server.js"]
