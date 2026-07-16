import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

// Hook for paginated list endpoints returning {items, total, page, page_size, total_pages}
export default function usePaginatedList(path, extraParams = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const paramsKey = JSON.stringify(extraParams);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        Object.entries(extraParams).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
        });
        const { data } = await api.get(`${path}?${params.toString()}`);
        if (!cancelled) {
          setItems(data.items || []);
          setTotal(data.total || 0);
        }
      } catch {
        if (!cancelled) { setItems([]); setTotal(0); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, pageSize, paramsKey, refreshTick]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => { setPage(1); }, [paramsKey]);

  return { items, total, page, pageSize, setPage, setPageSize, loading, refresh };
}
