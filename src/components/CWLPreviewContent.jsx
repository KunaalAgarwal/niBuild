import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import YAML from 'js-yaml';
import { buildCWLWorkflowObject, buildJobTemplate } from '../hooks/buildWorkflow.js';
import { useToast } from '../context/ToastContext.jsx';

const SHEBANG = '#!/usr/bin/env cwl-runner\n\n';

const escapeHtml = (str) =>
    str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export const highlightYaml = (yaml) => {
    return yaml
        .split('\n')
        .map((line) => {
            if (line.trimStart().startsWith('#')) {
                return `<span class="cwl-comment">${escapeHtml(line)}</span>`;
            }
            let hl = escapeHtml(line);
            hl = hl.replace(/^(\s*)([\w][\w-]*)(:)/, '$1<span class="cwl-key">$2</span>$3');
            hl = hl.replace(/&#39;(.*?)&#39;/g, '<span class="cwl-string">$&</span>');
            hl = hl.replace(/&quot;(.*?)&quot;/g, '<span class="cwl-string">$&</span>');
            hl = hl.replace(/\b(true|false|null)\b/g, '<span class="cwl-bool">$1</span>');
            hl = hl.replace(/(\s#.*)$/, '<span class="cwl-comment">$1</span>');
            return hl;
        })
        .join('\n');
};

/**
 * Pure CWL/YAML preview content. Computes both .cwl and .yml outputs from the workflow
 * graph and renders the selected pane. Used by CWLPreviewPanel (right-side panel) and
 * AuxTabRenderer (full editor tab).
 *
 * @param {Function} getWorkflowData - Returns { nodes, edges }
 * @param {'workflow'|'job'} pane - Which pane to render
 * @param {'panel'|'tab'} mode - Layout mode (affects CSS class)
 */
function CWLPreviewContent({ getWorkflowData, pane = 'workflow', mode = 'panel' }) {
    const { showWarning } = useToast();
    const [cwlOutput, setCwlOutput] = useState('');
    const [jobOutput, setJobOutput] = useState('');
    const [error, setError] = useState(null);
    const [showPlaceholder, setShowPlaceholder] = useState(true);
    const [copied, setCopied] = useState(false);
    const debounceRef = useRef(null);
    const copiedTimerRef = useRef(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (typeof getWorkflowData !== 'function') {
                setShowPlaceholder(true);
                return;
            }
            try {
                const graph = getWorkflowData();
                const realNodeCount = (graph?.nodes || []).filter((n) => !n.data?.isDummy).length;
                const hasCustomWorkflow = (graph?.nodes || []).some((n) => n.data?.isCustomWorkflow);
                if (!graph || !graph.nodes || (!hasCustomWorkflow && realNodeCount < 1)) {
                    setCwlOutput('');
                    setJobOutput('');
                    setError(null);
                    setShowPlaceholder(true);
                    return;
                }
                setShowPlaceholder(false);
                const { wf, jobDefaults, cwlDefaultKeys } = buildCWLWorkflowObject(graph);
                setCwlOutput(SHEBANG + YAML.dump(wf, { noRefs: true }));
                setJobOutput(buildJobTemplate(wf, jobDefaults, cwlDefaultKeys));
                setError(null);
            } catch (err) {
                setShowPlaceholder(false);
                setError(err.message);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [getWorkflowData]);

    useEffect(
        () => () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        },
        [],
    );

    const activeContent = pane === 'workflow' ? cwlOutput : jobOutput;
    const highlightedHtml = useMemo(() => (activeContent ? highlightYaml(activeContent) : ''), [activeContent]);
    // Line numbers for the gutter (shown in both panel and tab modes). One number per
    // '\n'-separated line; rendered as a single string inside a <pre> so each newline
    // naturally produces a row that aligns with the corresponding row of .cwl-code.
    const lineNumbers = useMemo(() => {
        if (!activeContent) return '';
        const count = activeContent.split('\n').length;
        return Array.from({ length: count }, (_, i) => i + 1).join('\n');
    }, [activeContent]);

    const handleCopy = useCallback(() => {
        if (!activeContent) return;
        navigator.clipboard
            .writeText(activeContent)
            .then(() => {
                setCopied(true);
                if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
                copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => showWarning('Copy to clipboard failed'));
    }, [activeContent, showWarning]);

    const containerClass = `cwl-preview-content${mode === 'tab' ? ' cwl-preview-content--tab' : ''}`;

    return (
        <div className={containerClass}>
            {error && (
                <div className="cwl-error-banner">
                    <span className="cwl-error-icon">!</span>
                    <span>{error}</span>
                </div>
            )}
            {showPlaceholder && !error && (
                <div className="cwl-empty-message">Add a node to preview the generated CWL workflow.</div>
            )}
            {activeContent && (
                <>
                    <button
                        className="cwl-content-copy-btn"
                        onClick={handleCopy}
                        disabled={!activeContent}
                        title="Copy to clipboard"
                    >
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <div className="cwl-code-block">
                        <pre className="cwl-line-gutter" aria-hidden="true">
                            {lineNumbers}
                        </pre>
                        <pre className="cwl-code" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                    </div>
                </>
            )}
        </div>
    );
}

export default CWLPreviewContent;
