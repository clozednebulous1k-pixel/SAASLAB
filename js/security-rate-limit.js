/**
 * Limite de tentativas no navegador (complementa o rate limit do Firebase Auth).
 * Não substitui regras do Firestore, só reduz abuso/brute force pela UI.
 */
(function () {
  const STORE_KEY = "saaslab_rate_v1";

  const BUCKETS = {
    auth: { max: 10, windowMs: 15 * 60 * 1000 },
    forgot: { max: 5, windowMs: 60 * 60 * 1000 },
    adminWrite: { max: 40, windowMs: 60 * 1000 },
  };

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function writeStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function pruneBucket(entries, windowMs, now) {
    return (entries || []).filter((t) => now - t < windowMs);
  }

  window.saasLabRateLimit = {
    /**
     * @returns {{ allowed: boolean, retryAfterSec?: number }}
     */
    check(bucketId) {
      const cfg = BUCKETS[bucketId];
      if (!cfg) return { allowed: true };

      const now = Date.now();
      const store = readStore();
      const times = pruneBucket(store[bucketId], cfg.windowMs, now);

      if (times.length >= cfg.max) {
        const oldest = times[0];
        const retryAfterSec = Math.ceil((cfg.windowMs - (now - oldest)) / 1000);
        return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
      }
      return { allowed: true };
    },

    record(bucketId) {
      const cfg = BUCKETS[bucketId];
      if (!cfg) return;

      const now = Date.now();
      const store = readStore();
      const times = pruneBucket(store[bucketId], cfg.windowMs, now);
      times.push(now);
      store[bucketId] = times;
      writeStore(store);
    },

    clear(bucketId) {
      const store = readStore();
      if (bucketId) delete store[bucketId];
      else Object.keys(BUCKETS).forEach((k) => delete store[k]);
      writeStore(store);
    },

    message(retryAfterSec) {
      const min = Math.ceil(retryAfterSec / 60);
      return min > 1
        ? `Muitas tentativas. Aguarde cerca de ${min} minutos.`
        : `Muitas tentativas. Aguarde ${retryAfterSec} segundos.`;
    },
  };
})();
