import { useState, useEffect, useCallback } from 'react';

interface CacheEntry {
  data: any;
  timestamp: number;
  searchTerms: string[];
  filters: {
    state?: string;
  };
}

interface CacheStore {
  [key: string]: CacheEntry;
}

const CACHE_KEY = 'market_intelligence_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos em milissegundos
const MAX_CACHE_ENTRIES = 20;

export const useMarketIntelligenceCache = () => {
  const [cache, setCache] = useState<CacheStore>({});

  // Carregar cache do localStorage na inicialização
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheStore;
        // Limpar entradas expiradas
        const now = Date.now();
        const validEntries: CacheStore = {};
        Object.entries(parsed).forEach(([key, entry]) => {
          if (now - entry.timestamp < CACHE_TTL) {
            validEntries[key] = entry;
          }
        });
        setCache(validEntries);
      }
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Gerar chave única para a busca
  const generateCacheKey = useCallback((searchTerms: string[], filters: { state?: string }) => {
    const sortedTerms = [...searchTerms].sort().join('|').toLowerCase();
    const stateFilter = filters.state || 'all';
    return `${sortedTerms}::${stateFilter}`;
  }, []);

  // Buscar do cache
  const getFromCache = useCallback((searchTerms: string[], filters: { state?: string }) => {
    const key = generateCacheKey(searchTerms, filters);
    const entry = cache[key];
    
    if (!entry) return null;
    
    // Verificar se expirou
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      // Remover entrada expirada
      const newCache = { ...cache };
      delete newCache[key];
      setCache(newCache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
      return null;
    }
    
    return entry.data;
  }, [cache, generateCacheKey]);

  // Salvar no cache
  const saveToCache = useCallback((searchTerms: string[], filters: { state?: string }, data: any) => {
    const key = generateCacheKey(searchTerms, filters);
    
    setCache(prev => {
      const newCache = { ...prev };
      
      // Se atingiu o limite, remover a entrada mais antiga
      const entries = Object.entries(newCache);
      if (entries.length >= MAX_CACHE_ENTRIES) {
        const oldest = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        if (oldest) {
          delete newCache[oldest[0]];
        }
      }
      
      newCache[key] = {
        data,
        timestamp: Date.now(),
        searchTerms,
        filters,
      };
      
      // Persistir no localStorage
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
      } catch (error) {
        console.error('Erro ao salvar cache:', error);
      }
      
      return newCache;
    });
  }, [generateCacheKey]);

  // Limpar cache
  const clearCache = useCallback(() => {
    setCache({});
    localStorage.removeItem(CACHE_KEY);
  }, []);

  // Obter estatísticas do cache
  const getCacheStats = useCallback(() => {
    const entries = Object.entries(cache);
    const now = Date.now();
    const validEntries = entries.filter(([, entry]) => now - entry.timestamp < CACHE_TTL);
    
    return {
      totalEntries: validEntries.length,
      oldestEntry: validEntries.length > 0 
        ? new Date(Math.min(...validEntries.map(([, e]) => e.timestamp)))
        : null,
      newestEntry: validEntries.length > 0 
        ? new Date(Math.max(...validEntries.map(([, e]) => e.timestamp)))
        : null,
    };
  }, [cache]);

  // Verificar se há cache válido
  const hasValidCache = useCallback((searchTerms: string[], filters: { state?: string }) => {
    return getFromCache(searchTerms, filters) !== null;
  }, [getFromCache]);

  return {
    getFromCache,
    saveToCache,
    clearCache,
    getCacheStats,
    hasValidCache,
    cacheSize: Object.keys(cache).length,
  };
};
