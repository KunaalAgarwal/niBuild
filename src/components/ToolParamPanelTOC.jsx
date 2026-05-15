/**
 * ToolParamPanelTOC — the left table-of-contents rail rendered alongside the
 * scrollable main pane in `ToolParamPanel`. Pure presentational; all state
 * (which entry is active, what to do on click) lives in the parent.
 *
 * Descriptor shape (built by the parent from the same conditionals that gate
 * each section in the main pane):
 *   {
 *     id:       string                                   // target dom id to scroll to
 *     label:    string                                   // user-visible text
 *     type:     'top' | 'paramsGroup'                    // structural kind
 *     children?: Array<{                                 // present when type='paramsGroup'
 *       id, label, type: 'subgroup',
 *       children: Array<{ id, label }>                   // leaf param entries
 *     }>
 *   }
 *
 * Sub-headers (`type: 'subgroup'`) are intentionally non-clickable — they
 * label the Required / Optional bands but aren't separate scroll targets;
 * the section-header `<div>` inside the main pane already serves as the
 * anchor for the parent params group.
 */
function ToolParamPanelTOC({ sections, activeId, onJump }) {
    if (!sections || sections.length === 0) return null;

    // The "Parameters" parent should stay highlighted whenever the user is anywhere
    // inside its descendant tree (Required/Optional sections or any leaf param card).
    const isGroupActive = (section) => {
        if (section.id === activeId) return true;
        return section.children?.some(
            (sub) => sub.id === activeId || sub.children?.some((leaf) => leaf.id === activeId),
        );
    };

    return (
        <nav className="tool-param-panel-toc" aria-label="Tool parameter sections">
            <ul className="tool-param-panel-toc-list">
                {sections.map((section) => {
                    if (section.type === 'paramsGroup') {
                        return (
                            <li key={section.id} className="tool-param-panel-toc-group">
                                <button
                                    type="button"
                                    className={`tool-param-panel-toc-item${isGroupActive(section) ? ' active' : ''}`}
                                    onClick={() => onJump(section.id)}
                                >
                                    {section.label}
                                </button>
                                {section.children?.map((sub) => (
                                    <div key={sub.id} className="tool-param-panel-toc-subgroup">
                                        <div className="tool-param-panel-toc-subheader">{sub.label}</div>
                                        <ul className="tool-param-panel-toc-sublist">
                                            {sub.children?.map((leaf) => (
                                                <li key={leaf.id}>
                                                    <button
                                                        type="button"
                                                        className={`tool-param-panel-toc-item tool-param-panel-toc-item--leaf${activeId === leaf.id ? ' active' : ''}`}
                                                        onClick={() => onJump(leaf.id)}
                                                        title={leaf.label}
                                                    >
                                                        {leaf.label}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </li>
                        );
                    }
                    return (
                        <li key={section.id}>
                            <button
                                type="button"
                                className={`tool-param-panel-toc-item${activeId === section.id ? ' active' : ''}`}
                                onClick={() => onJump(section.id)}
                            >
                                {section.label}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

export default ToolParamPanelTOC;
