
document.addEventListener('DOMContentLoaded', () => {
    // Initialize functionality
    initContextMenu();
    initCopyWidget();
});

// --- context menu logic (preserved) ---
function initContextMenu() {
    document.addEventListener('contextmenu', function (e) {
        if (e.shiftKey) return; // Allow default menu if Shift is held

        e.preventDefault();

        // Remove existing custom menu if any
        const existingMenu = document.getElementById('custom-ctx-menu');
        if (existingMenu) existingMenu.remove();

        // Smart selection logic
        const componentSelectors = [
            '.btn', '.alert', '.badge', '.card',
            '.form-control', '.form-select', '.form-check',
            '.dropdown', '.modal', '.offcanvas',
            'table', 'nav', 'header', 'footer'
        ];

        let target = e.target;
        let selectedComponent = null;

        // 1. Check if we clicked directly on or inside a known component type
        for (const selector of componentSelectors) {
            const closest = target.closest(selector);
            if (closest) {
                selectedComponent = closest;
                break; // Prioritize the first match (usually innermost)
            }
        }

        // 2. If no specific component found, use the target itself or parent if generic
        if (!selectedComponent) {
            selectedComponent = target; // Fallback
        }

        createContextMenu(e.clientX, e.clientY, selectedComponent);
    });
}

function createContextMenu(x, y, component) {
    const menu = document.createElement('div');
    menu.id = 'custom-ctx-menu';
    Object.assign(menu.style, {
        position: 'fixed',
        top: `${y}px`,
        left: `${x}px`,
        zIndex: '10000',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        padding: '6px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        cursor: 'default',
        minWidth: '160px',
        fontFamily: "'Inter', sans-serif"
    });

    const createItem = (text, onClick) => {
        const item = document.createElement('div');
        item.innerText = text;
        Object.assign(item.style, {
            padding: '8px 12px',
            fontSize: '14px',
            color: '#374151',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            cursor: 'pointer',
            marginBottom: '4px'
        });
        item.onmouseover = () => {
            item.style.backgroundColor = '#f3f4f6';
            item.style.color = '#111827';
        };
        item.onmouseout = () => {
            item.style.backgroundColor = 'transparent';
            item.style.color = '#374151';
        };
        item.onclick = onClick;
        return item;
    };

    menu.appendChild(createItem('Copy HTML Only', () => {
        const code = component.outerHTML;
        copyToClipboard(code);
        menu.remove();
    }));

    menu.appendChild(createItem('Copy HTML & CSS', async () => {
        const html = component.outerHTML;
        const css = await extractCSS(component);
        const output = `/* --- CSS --- */\n${css}\n\n<!-- --- HTML --- -->\n${html}`;
        copyToClipboard(output);
        menu.remove();
    }));
    
    // Add "Copy Page" option to context menu too
    menu.appendChild(createItem('Copy Entire Page', () => {
        const code = document.documentElement.outerHTML;
        copyToClipboard(code);
        menu.remove();
    }));

    document.body.appendChild(menu);

    const dismiss = () => {
        menu.remove();
        document.removeEventListener('click', dismiss);
    };
    setTimeout(() => document.addEventListener('click', dismiss), 50);
}


// --- New Copy Widget & Selection Mode ---

let isSelectionMode = false;
let hoveredElement = null;
let overlay = null;

function initCopyWidget() {
    // Create the floating widget
    const widget = document.createElement('div');
    widget.id = 'copy-helper-widget';
    Object.assign(widget.style, {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'flex-end'
    });

    // Check if widget already exists (idempotency)
    if (document.getElementById('copy-helper-widget')) return;

    // Button Generator
    const createBtn = (icon, text, onClick, isPrimary = false) => {
        const btn = document.createElement('button');
        btn.innerHTML = `<span>${icon}</span> <span style="font-size: 14px; font-weight: 500;">${text}</span>`;
        Object.assign(btn.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: isPrimary ? '#2563eb' : '#fff',
            color: isPrimary ? '#fff' : '#374151',
            border: isPrimary ? 'none' : '1px solid #d1d5db',
            borderRadius: '9999px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            transition: 'all 0.2s',
            outline: 'none'
        });
        
        btn.onmouseover = () => {
             btn.style.transform = 'translateY(-2px)';
             btn.style.boxShadow = '0 6px 8px -1px rgba(0, 0, 0, 0.15)';
        };
        btn.onmouseout = () => {
             btn.style.transform = 'translateY(0)';
             btn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        };

        btn.onclick = onClick;
        return btn;
    };

    // Copy Page Button
    const btnCopyPage = createBtn('📄', 'Copy Whole Page', () => {
        const fullHtml = document.documentElement.outerHTML;
        copyToClipboard(fullHtml);
    });

    // Select Element Toggle
    const btnSelect = createBtn('🔍', 'Select Element', () => {
        toggleSelectionMode(btnSelect);
    }, true); // Primary style

    widget.appendChild(btnCopyPage);
    widget.appendChild(btnSelect);
    document.body.appendChild(widget);

    // Create Overlay for highlighting
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        pointerEvents: 'none', // Allow clicks to pass through to the handler
        border: '3px solid #2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        zIndex: '9998',
        display: 'none',
        transition: 'all 0.1s ease-out',
        borderRadius: '4px'
    });
    document.body.appendChild(overlay);
}

function toggleSelectionMode(btn) {
    isSelectionMode = !isSelectionMode;

    if (isSelectionMode) {
        btn.innerHTML = '<span>❌</span> <span style="font-size: 14px; font-weight: 500;">Stop Selection</span>';
        btn.style.backgroundColor = '#dc2626'; // Red
        showToast("Hover and click any element to copy it!");
        
        document.addEventListener('mouseover', onHover, true);
        document.addEventListener('click', onSelectionClick, true);
    } else {
        btn.innerHTML = '<span>🔍</span> <span style="font-size: 14px; font-weight: 500;">Select Element</span>';
        btn.style.backgroundColor = '#2563eb'; // Blue
        
        document.removeEventListener('mouseover', onHover, true);
        document.removeEventListener('click', onSelectionClick, true);
        overlay.style.display = 'none';
        hoveredElement = null;
    }
}

function onHover(e) {
    if (!isSelectionMode) return;
    e.stopPropagation();
    
    const target = e.target;
    // Avoid selecting the helper widget itself
    if (target.closest('#copy-helper-widget') || target.closest('#copy-toast') || target === overlay) return;

    hoveredElement = target;
    
    // Position overlay
    const rect = target.getBoundingClientRect();
    Object.assign(overlay.style, {
        display: 'block',
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px'
    });
}

function onSelectionClick(e) {
    if (!isSelectionMode) return;
    
    // Ignore clicks on widget
    if (e.target.closest('#copy-helper-widget')) return;

    e.preventDefault();
    e.stopPropagation();

    if (hoveredElement) {
        const code = hoveredElement.outerHTML;
        copyToClipboard(code);
        // Optional: flash the overlay to indicate success
        const originalBorder = overlay.style.border;
        overlay.style.border = '3px solid #10b981'; // Green
        overlay.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
        
        setTimeout(() => {
            overlay.style.border = originalBorder;
            overlay.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
        }, 300);
    }
}

// --- Utilities ---

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Code copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy code. See console.');
    });
}

// Function to extract used CSS
async function extractCSS(rootElement) {
    const rulesUsed = new Set();
    const elements = [rootElement, ...rootElement.querySelectorAll('*')];

    try {
        // Iterate through all stylesheets
        for (const sheet of document.styleSheets) {
            try {
                // Check if we can access rules (CORS might block external sheets)
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;

                for (const rule of rules) {
                    if (rule.type === 1) { // CSSStyleRule
                        const selectors = rule.selectorText.split(',');
                        for (const selector of selectors) {
                            const trimmedSelector = selector.trim();
                            const baseSelector = trimmedSelector.split(':')[0];

                            let isMatched = false;

                            try {
                                if (trimmedSelector.includes(':')) {
                                    const cleanSelector = trimmedSelector.replace(/::?[a-zA-Z0-9-]+/g, '');
                                    if (!cleanSelector.trim()) continue;

                                    for (const el of elements) {
                                        if (el.matches(cleanSelector)) {
                                            isMatched = true;
                                            break;
                                        }
                                    }
                                } else {
                                    for (const el of elements) {
                                        if (el.matches(trimmedSelector)) {
                                            isMatched = true;
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                continue;
                            }

                            if (isMatched) {
                                rulesUsed.add(rule.cssText);
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                // Access restricted
            }
        }
    } catch (e) {
        return "/* Error extracting CSS: " + e.message + " */";
    }

    if (rulesUsed.size === 0) {
        return "/* No specific CSS rules found (using Tailwind utility classes?) */";
    }

    return Array.from(rulesUsed).join('\n');
}

// Simple Toast Notification
function showToast(message) {
    const existingToast = document.getElementById('copy-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'copy-toast';
    toast.innerText = message;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%', // Center bottom
        transform: 'translateX(-50%)',
        backgroundColor: '#10b981',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10001',
        fontSize: '14px',
        fontWeight: '500',
        opacity: '0',
        transition: 'opacity 0.3s ease'
    });

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.style.opacity = '1');

    // Remove after 2 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
