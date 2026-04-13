const { redis } = require("../config/redis");

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function getVersion(key) {
  try {
    const v = await redis.get(key);
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}

async function bumpVersion(key) {
  try {
    await redis.incr(key);
  } catch {
    // ignore cache invalidation errors
  }
}

function parkVersionKey(parkId) {
  return `cache:v:park:${parkId}`;
}

function cityVersionKey(cityId) {
  return `cache:v:city:${cityId}`;
}

async function cacheAsideJson({ key, ttlSeconds, loader }) {
  const cached = await redis.get(key).catch(() => null);
  if (cached) {
    const parsed = safeJsonParse(cached);
    if (parsed !== null) return { hit: true, data: parsed };
  }

  const data = await loader();
  await redis.set(key, JSON.stringify(data), "EX", ttlSeconds).catch(() => {});
  return { hit: false, data };
}

module.exports = {
  parkVersionKey,
  cityVersionKey,
  getVersion,
  bumpVersion,
  cacheAsideJson,
};

