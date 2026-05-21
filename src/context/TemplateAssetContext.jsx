import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { getTemplateById } from '../data/standardTemplates.js';

/**
 * Session-scoped store of standard-template file blobs. Fetched on demand
 * when a Standard Template node selects a variant; held in memory until the
 * RO-Crate export reads them back out to stage into `additional_inputs/`.
 *
 * Status table keys are templateIds (not node ids) so multiple nodes
 * selecting the same variant share a single fetch. The blob map is held in
 * a ref so it can be read synchronously from the export hook without
 * forcing renders when the cache hydrates.
 */

const TemplateAssetContext = createContext(null);

export function TemplateAssetProvider({ children }) {
    const blobsRef = useRef(new Map());
    const inflightRef = useRef(new Map());
    const [statusMap, setStatusMap] = useState(() => new Map());

    const setStatus = useCallback((id, status) => {
        setStatusMap((prev) => {
            const next = new Map(prev);
            next.set(id, status);
            return next;
        });
    }, []);

    const fetchTemplate = useCallback(
        (templateId) => {
            if (blobsRef.current.has(templateId)) {
                return Promise.resolve(blobsRef.current.get(templateId));
            }
            if (inflightRef.current.has(templateId)) {
                return inflightRef.current.get(templateId);
            }
            const tpl = getTemplateById(templateId);
            if (!tpl) {
                const err = new Error(`Unknown template id: ${templateId}`);
                setStatus(templateId, { kind: 'error', message: err.message });
                return Promise.reject(err);
            }
            setStatus(templateId, { kind: 'fetching' });

            const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
            const url = tpl.source.kind === 'bundled' ? `${base}templates/${tpl.filename}` : tpl.source.url;

            const promise = fetch(url)
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status} fetching ${url}`);
                    }
                    return res.blob();
                })
                .then((blob) => {
                    blobsRef.current.set(templateId, blob);
                    inflightRef.current.delete(templateId);
                    setStatus(templateId, { kind: 'ready', sizeBytes: blob.size });
                    return blob;
                })
                .catch((err) => {
                    inflightRef.current.delete(templateId);
                    setStatus(templateId, { kind: 'error', message: err.message });
                    throw err;
                });
            inflightRef.current.set(templateId, promise);
            return promise;
        },
        [setStatus],
    );

    const getTemplateBlob = useCallback((templateId) => blobsRef.current.get(templateId) || null, []);

    const getStatus = useCallback((templateId) => statusMap.get(templateId) || { kind: 'idle' }, [statusMap]);

    const value = useMemo(
        () => ({ fetchTemplate, getTemplateBlob, getStatus, statusMap }),
        [fetchTemplate, getTemplateBlob, getStatus, statusMap],
    );

    return <TemplateAssetContext.Provider value={value}>{children}</TemplateAssetContext.Provider>;
}

export function useTemplateAssets() {
    const ctx = useContext(TemplateAssetContext);
    if (!ctx) throw new Error('useTemplateAssets must be used inside <TemplateAssetProvider>');
    return ctx;
}

export { TemplateAssetContext };
