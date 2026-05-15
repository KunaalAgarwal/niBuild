import { useEffect, useState } from 'react';

/**
 * Track which observed DOM section is currently spotlighted inside a scroll
 * container — i.e., classic "scroll-spy" behaviour for a table-of-contents.
 *
 * Implementation: a single `IntersectionObserver` rooted on `container`. The
 * default `rootMargin` shrinks the bottom 60% of the root box, so the
 * "active band" is the top 40% of the scroll container; whichever observed
 * section has the smallest non-negative top inside that band becomes active.
 * When no observed section is in the band (e.g., scrolled into a gap between
 * sections), the previous active id is latched to avoid flicker.
 *
 * `suppressRef` is a writable ref the caller flips to `true` during a
 * programmatic smooth-scroll so the observer doesn't fight the optimistic
 * "forced active" the caller is showing in the TOC. Flip back to `false`
 * once the scroll settles.
 *
 * The observer rebuilds whenever `container` or the joined-id list changes.
 * Conditional sections that appear/disappear at runtime (e.g., the Scatter
 * Method section toggling on when a second scatter input becomes active) flow
 * naturally because the parent will pass a new `ids` array, which triggers a
 * rebuild and a fresh observe of the now-mounted elements.
 *
 * @param {Object} opts
 * @param {string[]} opts.ids - DOM ids to observe.
 * @param {HTMLElement | null} opts.container - the scroll root.
 * @param {string} [opts.rootMargin] - IntersectionObserver rootMargin.
 * @param {number} [opts.threshold] - IntersectionObserver threshold.
 * @param {{ current: boolean }} [opts.suppressRef] - when current=true, skip updates.
 * @returns {{ activeId: string | null }}
 */
export function useScrollSpy({ ids, container, rootMargin = '0px 0px -60% 0px', threshold = 0, suppressRef }) {
    const [activeId, setActiveId] = useState(null);

    // Join the ids into a stable string so a parent passing a fresh array on
    // every render (same contents) doesn't churn the effect.
    const idsKey = ids?.join('|') || '';

    useEffect(() => {
        if (!container || !ids || ids.length === 0) {
            setActiveId(null);
            return undefined;
        }

        // Latest IntersectionObserverEntry keyed by target id. The map persists
        // across observer callbacks so we can derive the active id from the
        // full set, not just the entries that changed in this batch.
        const entryMap = new Map();

        const recompute = () => {
            if (suppressRef?.current) return;
            let bestId = null;
            let bestTop = Infinity;
            for (const [id, entry] of entryMap.entries()) {
                if (!entry.isIntersecting) continue;
                const top = entry.boundingClientRect.top;
                if (top < bestTop) {
                    bestTop = top;
                    bestId = id;
                }
            }
            if (bestId !== null) setActiveId(bestId);
            // Else: nothing in the band — latch previous activeId (no flicker).
        };

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    entryMap.set(entry.target.id, entry);
                }
                recompute();
            },
            { root: container, rootMargin, threshold },
        );

        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [container, idsKey, rootMargin, threshold, suppressRef]);

    return { activeId };
}
