
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
        'table'
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

    // 2. If no specific component found, use the target itself (e.g. text paragraph)
    if (!selectedComponent) {
        selectedComponent = target;
    }

    // Create menu container
    const menu = document.createElement('div');
    menu.id = 'custom-ctx-menu';
    Object.assign(menu.style, {
        position: 'fixed',
        top: `${e.clientY}px`,
        left: `${e.clientX}px`,
        zIndex: '10000',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        padding: '6px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        cursor: 'pointer',
        minWidth: '160px',
        fontFamily: "'Inter', sans-serif"
    });

    // Create "Copy HTML Only" item
    const copyHtmlItem = document.createElement('div');
    copyHtmlItem.innerText = 'Copy HTML Only';
    Object.assign(copyHtmlItem.style, {
        padding: '8px 12px',
        fontSize: '14px',
        color: '#374151',
        borderRadius: '4px',
        transition: 'background-color 0.2s',
        marginBottom: '4px'
    });

    const hoverStyle = (el) => {
        el.onmouseover = () => {
            el.style.backgroundColor = '#f3f4f6';
            el.style.color = '#111827';
        };
        el.onmouseout = () => {
            el.style.backgroundColor = 'transparent';
            el.style.color = '#374151';
        };
    };
    hoverStyle(copyHtmlItem);

    // Create "Copy HTML & CSS" item
    const copyBothItem = document.createElement('div');
    copyBothItem.innerText = 'Copy HTML & CSS';
    Object.assign(copyBothItem.style, {
        padding: '8px 12px',
        fontSize: '14px',
        color: '#374151',
        borderRadius: '4px',
        transition: 'background-color 0.2s'
    });
    hoverStyle(copyBothItem);

    // Copy HTML Action
    copyHtmlItem.onclick = () => {
        const code = selectedComponent.outerHTML;
        copyToClipboard(code);
        menu.remove();
    };

    // Copy HTML & CSS Action
    copyBothItem.onclick = async () => {
        const html = selectedComponent.outerHTML;
        const css = await extractCSS(selectedComponent);

        const output = `/* --- CSS --- */\n${css}\n\n<!-- --- HTML --- -->\n${html}`;
        copyToClipboard(output);
        menu.remove();
    };

    menu.appendChild(copyHtmlItem);
    menu.appendChild(copyBothItem);
    document.body.appendChild(menu);

    // Click outside to dismiss
    const dismiss = () => {
        menu.remove();
        document.removeEventListener('click', dismiss);
    };
    setTimeout(() => document.addEventListener('click', dismiss), 50);
});

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
                            // Basic check: does this selector apply to any of our elements?
                            // We strip pseudo-classes for the match check to be inclusive
                            // e.g. .btn:hover matches if .btn is on the element
                            const baseSelector = trimmedSelector.split(':')[0];

                            let isMatched = false;

                            // Check match directly on element properties would be hard for pseudos
                            // So we use element.matches() on the base part of selector
                            try {
                                if (trimmedSelector.includes(':')) {
                                    // Remove common pseudos to check if the base element matches
                                    // This isn't perfect but covers :hover, :focus, ::after etc
                                    const cleanSelector = trimmedSelector.replace(/::?[a-zA-Z0-9-]+/g, '');
                                    if (!cleanSelector.trim()) continue;

                                    for (const el of elements) {
                                        if (el.matches(cleanSelector)) {
                                            isMatched = true;
                                            break;
                                        }
                                    }
                                } else {
                                    // Direct match
                                    for (const el of elements) {
                                        if (el.matches(trimmedSelector)) {
                                            isMatched = true;
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                // invalid selector or other error
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
        right: '20px',
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
