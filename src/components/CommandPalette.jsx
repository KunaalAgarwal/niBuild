import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toolsByModality, dummyNodes } from '../utils/toolAnnotations';
import '../styles/commandPalette.css';

function buildAllTools() {
    const tools = [];
    for (const ioNode of dummyNodes['I/O']) {
        tools.push({
            type: 'tool',
            name: ioNode.name,
            fullName: ioNode.fullName,
            description: ioNode.function,
            modality: 'I/O',
            isDummy: true,
            isBIDS: ioNode.isBIDS || false,
            isOutputNode: ioNode.isOutputNode || false,
        });
    }
    for (const [modality, libraries] of Object.entries(toolsByModality)) {
        for (const [, categories] of Object.entries(libraries)) {
            for (const [, toolList] of Object.entries(categories)) {
                for (const tool of toolList) {
                    tools.push({
                        type: 'tool',
                        name: tool.name,
                        fullName: tool.fullName || tool.name,
                        description: tool.function || '',
                        modality,
                        isDummy: false,
                        isBIDS: false,
                        isOutputNode: false,
                    });
                }
            }
        }
    }
    return tools;
}

const ALL_TOOLS = buildAllTools();

function CommandPalette({ isOpen, onClose, actions, customWorkflows, onSelectTool, onSelectWorkflow }) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const resultsRef = useRef(null);

    const allItems = useMemo(() => {
        const items = [];
        for (const action of actions) {
            items.push({
                type: 'action',
                id: action.id,
                name: action.label,
                description: '',
                handler: action.handler,
                disabled: action.disabled || false,
                searchText: action.label.toLowerCase(),
            });
        }
        for (const tool of ALL_TOOLS) {
            items.push({
                ...tool,
                searchText: `${tool.name} ${tool.fullName} ${tool.description} ${tool.modality}`.toLowerCase(),
            });
        }
        for (const wf of customWorkflows) {
            const toolNames = (wf.nodes || []).map((n) => n.label || n.data?.label || '').join(' ');
            items.push({
                type: 'workflow',
                id: wf.id,
                name: wf.name,
                description: `${(wf.nodes || []).length} nodes`,
                workflow: wf,
                searchText: `${wf.name} ${toolNames}`.toLowerCase(),
            });
        }
        return items;
    }, [actions, customWorkflows]);

    const filteredItems = useMemo(() => {
        if (!query.trim()) return allItems;
        const term = query.toLowerCase().trim();
        return allItems.filter((item) => item.searchText.includes(term));
    }, [allItems, query]);

    const groupedItems = useMemo(() => {
        const groups = [];
        const actionItems = filteredItems.filter((i) => i.type === 'action');
        const toolItems = filteredItems.filter((i) => i.type === 'tool');
        const workflowItems = filteredItems.filter((i) => i.type === 'workflow');
        if (actionItems.length > 0) groups.push({ label: 'Actions', items: actionItems });
        if (toolItems.length > 0) groups.push({ label: 'Tools', items: toolItems });
        if (workflowItems.length > 0) groups.push({ label: 'Workflows', items: workflowItems });
        return groups;
    }, [filteredItems]);

    const flatFiltered = useMemo(() => {
        return groupedItems.flatMap((g) => g.items);
    }, [groupedItems]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredItems]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isOpen]);

    useEffect(() => {
        const el = resultsRef.current?.querySelector('.command-palette-item.selected');
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const handleSelect = useCallback(
        (item) => {
            if (item.disabled) return;
            if (item.type === 'action') {
                item.handler();
            } else if (item.type === 'tool') {
                onSelectTool(item);
            } else if (item.type === 'workflow') {
                onSelectWorkflow(item.workflow);
            }
            onClose();
        },
        [onSelectTool, onSelectWorkflow, onClose],
    );

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    let next = prev + 1;
                    while (next < flatFiltered.length && flatFiltered[next]?.disabled) next++;
                    return next >= flatFiltered.length ? 0 : next;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    let next = prev - 1;
                    while (next >= 0 && flatFiltered[next]?.disabled) next--;
                    return next < 0 ? flatFiltered.length - 1 : next;
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = flatFiltered[selectedIndex];
                if (item) handleSelect(item);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        },
        [flatFiltered, selectedIndex, handleSelect, onClose],
    );

    if (!isOpen) return null;

    let globalIdx = 0;

    return createPortal(
        <>
            <div className="command-palette-backdrop" onClick={onClose} />
            <div className="command-palette">
                <div className="command-palette-input-wrapper">
                    <svg
                        className="command-palette-input-icon"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={inputRef}
                        className="command-palette-input"
                        type="text"
                        placeholder="Search tools, workflows, actions..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <div className="command-palette-results" ref={resultsRef}>
                    {groupedItems.length === 0 ? (
                        <div className="command-palette-empty">No results found</div>
                    ) : (
                        groupedItems.map((group) => (
                            <div key={group.label}>
                                <div className="command-palette-category">{group.label}</div>
                                {group.items.map((item) => {
                                    const idx = globalIdx++;
                                    return (
                                        <div
                                            key={item.id || item.name}
                                            className={`command-palette-item${idx === selectedIndex ? ' selected' : ''}${item.disabled ? ' disabled' : ''}`}
                                            onClick={() => handleSelect(item)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <span className="command-palette-badge">
                                                {item.type === 'action'
                                                    ? 'Action'
                                                    : item.type === 'workflow'
                                                      ? 'Workflow'
                                                      : item.modality || 'Tool'}
                                            </span>
                                            <span className="command-palette-item-name">
                                                {item.fullName || item.name}
                                            </span>
                                            {item.description && (
                                                <span className="command-palette-item-description">
                                                    {item.description}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
                <div className="command-palette-footer">
                    <span>
                        <kbd>↑↓</kbd> navigate
                    </span>
                    <span>
                        <kbd>↵</kbd> select
                    </span>
                    <span>
                        <kbd>esc</kbd> close
                    </span>
                </div>
            </div>
        </>,
        document.body,
    );
}

export default CommandPalette;
