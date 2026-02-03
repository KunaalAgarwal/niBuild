import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/tagDropdown.css';

/**
 * Custom dropdown for selecting Docker image tags.
 * Matches the project's dark theme UI patterns.
 */
const TagDropdown = ({
    value,
    onChange,
    onBlur,
    tags = [],
    placeholder = 'latest',
    isValid = true,
    prefix = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [filteredTags, setFilteredTags] = useState(tags);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // Sync internal value with prop
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Always show all tags (no filtering)
    useEffect(() => {
        setFilteredTags(tags);
        setHighlightedIndex(-1);
    }, [tags]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Update dropdown position when opening
    useEffect(() => {
        if (isOpen && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width
            });
        }
    }, [isOpen]);

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange(newValue);
        if (!isOpen) setIsOpen(true);
    };

    const handleInputFocus = () => {
        setIsOpen(true);
    };

    const handleInputBlur = (e) => {
        // Delay to allow click on dropdown item
        setTimeout(() => {
            if (onBlur) onBlur(e);
        }, 150);
    };

    const handleSelectTag = (tag) => {
        setInputValue(tag);
        onChange(tag);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredTags.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && filteredTags[highlightedIndex]) {
                    handleSelectTag(filteredTags[highlightedIndex]);
                } else {
                    setIsOpen(false);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
            case 'Tab':
                setIsOpen(false);
                break;
            default:
                break;
        }
    };

    const dropdownContent = isOpen && filteredTags.length > 0 && createPortal(
        <div
            className="tag-dropdown-list"
            style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width
            }}
        >
            {filteredTags.map((tag, index) => (
                <div
                    key={tag}
                    className={`tag-dropdown-item ${
                        index === highlightedIndex ? 'highlighted' : ''
                    } ${tag === inputValue ? 'selected' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectTag(tag);
                    }}
                >
                    {tag}
                    {tag === 'latest' && (
                        <span className="tag-badge">default</span>
                    )}
                </div>
            ))}
        </div>,
        document.body
    );

    return (
        <div
            ref={wrapperRef}
            className={`tag-dropdown-wrapper ${isOpen ? 'focused' : ''} ${!isValid ? 'invalid' : ''}`}
        >
            {prefix && (
                <span className="tag-dropdown-prefix">{prefix}</span>
            )}
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={`tag-dropdown-input ${!isValid ? 'invalid' : ''}`}
                autoComplete="off"
            />
            <span
                className={`tag-dropdown-chevron ${isOpen ? 'open' : ''}`}
                onClick={() => {
                    setIsOpen(!isOpen);
                    inputRef.current?.focus();
                }}
            >
                ▼
            </span>
            {dropdownContent}
        </div>
    );
};

export default TagDropdown;
