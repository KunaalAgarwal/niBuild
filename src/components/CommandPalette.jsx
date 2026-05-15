import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../styles/commandPalette.css';

// The palette surfaces two kinds of entries: invocable Actions (from main.jsx's
// `paletteActions`) and saved Workflows / Custom Nodes (from `customWorkflows`).
// Draggable tool/IO entries used to live here too, but the sidebar's workflow
// menu is the canonical place to add tools — the palette stays focused on
// commands and saved-entry navigation.
function CommandPalette({ isOpen, onClose, actions, customWorkflows, onSelectWorkflow, anchorEl, query = '' }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    // Anchor-driven position: measured from the TopBar search bar so the palette
    // visually extends from its bottom edge as a continuous dropdown.
    const [pos, setPos] = useState(null);
    const resultsRef = useRef(null);

    const allItems = useMemo(() => {
        const items = [];
        for (const action of actions) {
            items.push({
                type: 'action',
                id: action.id,
                name: action.label,
                handler: action.handler,
                disabled: action.disabled || false,
                searchText: action.label.toLowerCase(),
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
        const workflowItems = filteredItems.filter((i) => i.type === 'workflow');
        if (actionItems.length > 0) groups.push({ label: 'Actions', items: actionItems });
        if (workflowItems.length > 0) groups.push({ label: 'Workflows', items: workflowItems });
        return groups;
    }, [filteredItems]);

    // `filteredItems` doubles as the flat list for keyboard navigation: items
    // are built in actions-then-workflows order, the filter preserves that
    // order, and the render iterates groups in the same order — so the visual
    // index matches the array index directly. No separate flat memo needed.

    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredItems]);

    // Pin the palette to the bottom edge of the TopBar search bar. Recomputes on
    // window resize and on any ancestor scroll (capture-phase) so the dropdown
    // tracks the anchor regardless of how the layout shifts.
    useLayoutEffect(() => {
        if (!isOpen || !anchorEl) return;
        const compute = () => {
            const r = anchorEl.getBoundingClientRect();
            setPos({ left: r.left, top: r.bottom, width: r.width });
        };
        compute();
        window.addEventListener('resize', compute);
        window.addEventListener('scroll', compute, true);
        return () => {
            window.removeEventListener('resize', compute);
            window.removeEventListener('scroll', compute, true);
        };
    }, [isOpen, anchorEl]);

    useEffect(() => {
        if (isOpen) setSelectedIndex(0);
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
            } else if (item.type === 'workflow') {
                onSelectWorkflow(item.workflow);
            }
            onClose();
        },
        [onSelectWorkflow, onClose],
    );

    // Keyboard navigation is bound at the document level so it works while the
    // user is typing into the TopBar search input — the palette no longer
    // renders its own input row when anchored.
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    let next = prev + 1;
                    while (next < filteredItems.length && filteredItems[next]?.disabled) next++;
                    return next >= filteredItems.length ? 0 : next;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    let next = prev - 1;
                    while (next >= 0 && filteredItems[next]?.disabled) next--;
                    return next < 0 ? filteredItems.length - 1 : next;
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = filteredItems[selectedIndex];
                if (item) handleSelect(item);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex, handleSelect, onClose]);

    if (!isOpen) return null;

    let globalIdx = 0;

    return createPortal(
        <>
            <div className="command-palette-backdrop" onClick={onClose} />
            <div
                className="command-palette"
                style={pos ? { left: pos.left, top: pos.top, width: pos.width } : undefined}
            >
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
                                            key={item.id}
                                            className={`command-palette-item${idx === selectedIndex ? ' selected' : ''}${item.disabled ? ' disabled' : ''}`}
                                            onClick={() => handleSelect(item)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <span className="command-palette-item-name">{item.name}</span>
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
