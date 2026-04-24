import { useCallback, useRef, useEffect } from 'react';

/**
 * Infinite scroll hook using IntersectionObserver.
 * Triggers loadMore when sentinel element is visible.
 */
export default function useInfiniteScroll(loadMore, hasMore, loading) {
  const observer = useRef(null);

  const sentinelRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            loadMore();
          }
        },
        { rootMargin: '200px' }
      );

      if (node) observer.current.observe(node);
    },
    [loading, hasMore, loadMore]
  );

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  return sentinelRef;
}
