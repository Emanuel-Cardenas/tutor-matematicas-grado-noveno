'use client';
import { useEffect, useRef } from 'react';
import katex from 'katex';

const CURRENCY_TOKEN = '\uE000';
const THINSPACE_TOKEN = '\uE001';
const LINEBREAK_TOKEN = '\uE002';
const BLOCK_TOKEN_START = '\uE100';
const BLOCK_TOKEN_END = '\uE101';

/**
 * MathText — Renderiza texto con expresiones matemáticas LaTeX.
 * 
 * Soporta dos formatos:
 *  - Inline:  $expresión$  o \(expresión\)
 *  - Display: $$expresión$$ o \[expresión\]
 * 
 * Además, auto-detecta expresiones LaTeX sin delimitadores (bare LaTeX)
 * como \frac{}{}, \sqrt{}, \sum_{}, etc. y las envuelve automáticamente.
 */
export default function MathText({ text, className = '', style = {} }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !text) return;

        const textStr = normalizeLatexSource(String(text));
        const tikzBlocks = [];
        const tabularBlocks = [];

        // 1. Extraer bloques TikZ antes de procesar KaTeX
        const tikzRegex = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g;
        let tempText = textStr.replace(tikzRegex, (m) => {
            tikzBlocks.push(m);
            return `${BLOCK_TOKEN_START}T${tikzBlocks.length - 1}${BLOCK_TOKEN_END}`;
        });

        // 2. Extraer bloques tabular y parsearlos a HTML
        tempText = replaceTablaMacros(tempText, (alignSpec, tableContent) => {
            const tableHtml = parseLatexTable(alignSpec, tableContent);
            tabularBlocks.push(tableHtml);
            return `${BLOCK_TOKEN_START}B${tabularBlocks.length - 1}${BLOCK_TOKEN_END}`;
        });

        tempText = replaceTabularEnvironments(tempText, (alignSpec, tableContent) => {
            const tableHtml = parseLatexTable(alignSpec, tableContent);
            tabularBlocks.push(tableHtml);
            return `${BLOCK_TOKEN_START}B${tabularBlocks.length - 1}${BLOCK_TOKEN_END}`;
        });

        // Limpiar comandos residuales de tablas comunes
        tempText = tempText
            .replace(/\\begin\{center\}/g, '')
            .replace(/\\end\{center\}/g, '')
            .replace(/\\begin\{multicols\}\{[^}]*\}/g, '\n')
            .replace(/\\end\{multicols\}/g, '\n')
            .replace(/\\columnbreak/g, '\n')
            .replace(/\\renewcommand\{\\arraystretch\}\{.*?\}/g, '')
            .replace(/\\(?:scriptsize|footnotesize|small|normalsize|large|Large)\b/g, '')
            .replace(/\\centering/g, '');

        // 3. Sanitizar y renderizar KaTeX en el resto del texto
        const sanitized = sanitizeLatex(tempText);
        let renderedHtml = renderMathText(sanitized);

        // 4. Restaurar las tablas HTML
        renderedHtml = renderedHtml.replace(new RegExp(`${BLOCK_TOKEN_START}B(\\d+)${BLOCK_TOKEN_END}`, 'g'), (_, idx) => {
            return tabularBlocks[parseInt(idx)];
        });

        // 5. Restaurar bloques TikZ como holders activos
        renderedHtml = renderedHtml.replace(new RegExp(`${BLOCK_TOKEN_START}T(\\d+)${BLOCK_TOKEN_END}`, 'g'), (_, idx) => {
            const tikzCode = tikzBlocks[parseInt(idx)];
            const finalCode = `\\usetikzlibrary{babel,arrows.meta,calc,angles,quotes,positioning,patterns}\n\\pgfplotsset{compat=1.18}\n${tikzCode}`;
            return renderTikzBlock(tikzCode, finalCode);
        });

        renderedHtml = restoreLiteralTokens(renderedHtml);
        containerRef.current.innerHTML = renderedHtml;

        // 6. Activar dinámicamente los scripts de TikZ en el DOM
        const holders = containerRef.current.querySelectorAll('.tikz-holder[data-code]');
        holders.forEach(holder => {
            const code = holder.getAttribute('data-code');
            const script = document.createElement('script');
            script.type = 'text/tikz';
            script.textContent = code;
            holder.appendChild(script);
        });

        // 7. Cargar TikZJax de forma debouncada si hay gráficos
        if (holders.length > 0) {
            if (window.tikzjaxTimeout) {
                clearTimeout(window.tikzjaxTimeout);
            }
            window.tikzjaxTimeout = setTimeout(() => {
                const existing = document.getElementById('tikzjax-script');
                if (existing) {
                    existing.remove();
                }
                const script = document.createElement('script');
                script.id = 'tikzjax-script';
                const timestamp = Date.now();
                script.src = `https://tikzjax.com/v1/tikzjax.js?t=${timestamp}`;
                script.defer = true;
                document.body.appendChild(script);
            }, 50);
        }
    }, [text]);

    if (!text) return null;

    return (
        <span
            ref={containerRef}
            className={`math-text ${className}`}
            style={style}
        />
    );
}

// ──────────────────────────────────────────────────
// PRE-PROCESSING: Sanitize AI output to fix common LaTeX issues
// ──────────────────────────────────────────────────

// LaTeX commands that indicate math mode
const LATEX_COMMANDS = [
    'frac', 'sqrt', 'sum', 'prod', 'int', 'lim', 'log', 'ln',
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu',
    'pi', 'sigma', 'omega', 'phi', 'psi',
    'infty', 'partial', 'nabla',
    'leq', 'geq', 'neq', 'approx', 'equiv', 'sim',
    'times', 'cdot', 'div',
    'mathbb', 'mathbf', 'mathrm', 'text',
    'begin', 'end',
    'left', 'right',
    'angle', 'triangle',
    'overline', 'underline', 'hat', 'bar', 'vec',
    'binom',
    'pm', 'mp',
    'Big', 'big', 'Bigg', 'bigg',
    'to', 'rightarrow', 'Rightarrow',
];

const LATEX_CMD_PATTERN = new RegExp(
    `\\\\\\\\(${LATEX_COMMANDS.join('|')})(?=[{\\\\[_^(\\\\s]|$)`,
    'g'
);

function normalizeLatexSource(text) {
    if (!text) return '';
    return String(text)
        .replace(/\r\n/g, '\n')
        .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
        .replace(/\?`/g, '¿')
        .replace(/`/g, '')
        .replace(/\\n(?!abla|eq|ewline|ot|u\b|e\b|atural)/g, ' ')
        .replace(/\\*\$(?=\d{1,3}(?:[.,]\d{3})+(?![\d.,]))/g, CURRENCY_TOKEN)
        .replace(/&dollar;|&#36;/gi, CURRENCY_TOKEN)
        .replace(/&thinsp;|&#8201;/gi, THINSPACE_TOKEN)
        .replace(/\u00a0/g, ' ');
}

function restoreLiteralTokens(html) {
    return String(html)
        .replaceAll(CURRENCY_TOKEN, '$')
        .replaceAll(THINSPACE_TOKEN, '&thinsp;')
        .replaceAll(LINEBREAK_TOKEN, '<br />');
}

function readBalancedGroup(text, openBraceIndex) {
    if (text[openBraceIndex] !== '{') return null;
    let depth = 0;
    for (let i = openBraceIndex; i < text.length; i++) {
        const char = text[i];
        const prev = text[i - 1];
        if (char === '{' && prev !== '\\') depth++;
        if (char === '}' && prev !== '\\') {
            depth--;
            if (depth === 0) {
                return {
                    content: text.substring(openBraceIndex + 1, i),
                    start: openBraceIndex,
                    end: i + 1,
                };
            }
        }
    }
    return null;
}

function findMatchingEnvironmentEnd(text, envName, searchStart) {
    const beginToken = `\\begin{${envName}}`;
    const endToken = `\\end{${envName}}`;
    let depth = 1;
    let pos = searchStart;

    while (pos < text.length) {
        const nextBegin = text.indexOf(beginToken, pos);
        const nextEnd = text.indexOf(endToken, pos);
        if (nextEnd === -1) return -1;
        if (nextBegin !== -1 && nextBegin < nextEnd) {
            depth++;
            pos = nextBegin + beginToken.length;
        } else {
            depth--;
            if (depth === 0) return nextEnd;
            pos = nextEnd + endToken.length;
        }
    }

    return -1;
}

function replaceTabularEnvironments(text, callback) {
    const beginToken = '\\begin{tabular}';
    const endToken = '\\end{tabular}';
    let result = '';
    let pos = 0;

    while (pos < text.length) {
        const start = text.indexOf(beginToken, pos);
        if (start === -1) {
            result += text.substring(pos);
            break;
        }

        result += text.substring(pos, start);
        let cursor = start + beginToken.length;

        if (text[cursor] === '[') {
            const optEnd = text.indexOf(']', cursor + 1);
            if (optEnd !== -1) cursor = optEnd + 1;
        }

        while (/\s/.test(text[cursor] || '')) cursor++;
        const alignGroup = readBalancedGroup(text, cursor);
        if (!alignGroup) {
            result += beginToken;
            pos = cursor;
            continue;
        }

        cursor = alignGroup.end;
        const end = findMatchingEnvironmentEnd(text, 'tabular', cursor);
        if (end === -1) {
            result += text.substring(start);
            break;
        }

        const tableContent = text.substring(cursor, end);
        result += callback(alignGroup.content, tableContent);
        pos = end + endToken.length;
    }

    return result;
}

function replaceTablaMacros(text, callback) {
    const macro = '\\tabla';
    let result = '';
    let pos = 0;

    while (pos < text.length) {
        const start = text.indexOf(macro, pos);
        if (start === -1) {
            result += text.substring(pos);
            break;
        }

        result += text.substring(pos, start);
        let cursor = start + macro.length;
        while (/\s/.test(text[cursor] || '')) cursor++;

        const alignGroup = readBalancedGroup(text, cursor);
        if (!alignGroup) {
            result += macro;
            pos = cursor;
            continue;
        }

        cursor = alignGroup.end;
        while (/\s/.test(text[cursor] || '')) cursor++;

        const contentGroup = readBalancedGroup(text, cursor);
        if (!contentGroup) {
            result += text.substring(start, cursor);
            pos = cursor;
            continue;
        }

        result += callback(alignGroup.content, contentGroup.content);
        pos = contentGroup.end;
    }

    return result;
}

/**
 * Sanitize text to fix common AI LaTeX formatting issues:
 * 1. Detect bare LaTeX commands not inside $...$ and wrap them
 * 2. Fix malformed $..$ (single dollar with LaTeX inside)
 * 3. Fix {,} number formatting issues
 * 4. Fix \$ used for currency (convert to plain $)
 */
function sanitizeLatex(text) {
    if (!text) return '';
    let s = text;

    s = normalizeLatexSource(s);

    // Parse math regions to protect \$ and other LaTeX commands inside math
    const regions = [];
    let i = 0;
    while (i < s.length) {
        if (s[i] === '$') {
            if (s[i + 1] === '$') {
                const end = s.indexOf('$$', i + 2);
                if (end !== -1) {
                    regions.push({ start: i, end: end + 2, isMath: true });
                    i = end + 2;
                    continue;
                }
            }
            const end = s.indexOf('$', i + 1);
            if (end !== -1) {
                regions.push({ start: i, end: end + 1, isMath: true });
                i = end + 1;
                continue;
            }
        } else if (s[i] === '\\') {
            if (s[i + 1] === '[') {
                const end = s.indexOf('\\]', i + 2);
                if (end !== -1) {
                    regions.push({ start: i, end: end + 2, isMath: true });
                    i = end + 2;
                    continue;
                }
            } else if (s[i + 1] === '(') {
                const end = s.indexOf('\\)', i + 2);
                if (end !== -1) {
                    regions.push({ start: i, end: end + 2, isMath: true });
                    i = end + 2;
                    continue;
                }
            }
        }
        i++;
    }

    // Reconstruct the string, applying replacements ONLY outside math regions
    let reconstructed = '';
    let lastIndex = 0;
    for (const r of regions) {
        // Outside math
        let outside = s.substring(lastIndex, r.start);
        // Convert any currency $ or \$ to CURRENCY_TOKEN
        outside = outside.replace(/\\+\$(\d)/g, CURRENCY_TOKEN + '$1');
        outside = outside.replace(/\$(\d)/g, CURRENCY_TOKEN + '$1');
        outside = outside.replace(/\\+\$/g, CURRENCY_TOKEN);
        outside = outside.replace(/\$/g, CURRENCY_TOKEN);
        outside = outside.replace(/&dollar;|&#36;/gi, CURRENCY_TOKEN);

        reconstructed += outside;

        // Inside math: keep it as is, but fix missing braces for \text inside math!
        let inside = s.substring(r.start, r.end);
        inside = inside.replace(/\\text([a-zA-ZáéíóúñÁÉÍÓÚÑ\s_]+)/g, '\\text{$1}');

        reconstructed += inside;
        lastIndex = r.end;
    }

    // Trailing outside math
    let outside = s.substring(lastIndex);
    outside = outside.replace(/\\+\$(\d)/g, CURRENCY_TOKEN + '$1');
    outside = outside.replace(/\$(\d)/g, CURRENCY_TOKEN + '$1');
    outside = outside.replace(/\\+\$/g, CURRENCY_TOKEN);
    outside = outside.replace(/\$/g, CURRENCY_TOKEN);
    outside = outside.replace(/&dollar;|&#36;/gi, CURRENCY_TOKEN);
    reconstructed += outside;

    s = reconstructed;
    s = normalizeEscapedDollarMathDelimiters(s);

    // 2. Reemplazar \% (escapado de LaTeX) por % plano
    s = s.replace(/\\+%/g, '%');

    // 3. Reemplazar ~ (espacio indivisible de LaTeX) por espacio normal
    s = s.replace(/~/g, ' ');

    // 4. Reemplazar \, (espacio fino de LaTeX para miles o separación) por token interno
    s = s.replace(/\\,/g, THINSPACE_TOKEN);
    s = s.replace(/&thinsp;|&#8201;/gi, THINSPACE_TOKEN);

    // 5. Corregir signos de dólar huérfanos desparejados (si el conteo total es impar)
    const dollarCount = (s.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
        const lastIdx = s.lastIndexOf('$');
        if (lastIdx !== -1) {
            s = s.substring(0, lastIdx) + CURRENCY_TOKEN + s.substring(lastIdx + 1);
        }
    }

    s = restoreCorruptedLatex(s);

    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(?<![\\$])\*([^*]+)\*(?![\\$])/g, '<em>$1</em>');
    s = replaceLatexTextCommandsOutsideMath(s);

    s = s.replace(/\\(\d)/g, '$1'); 

    s = wrapBareLatex(s);

    s = cleanCommasOutsideMath(s);

    return s;
}

function normalizeEscapedDollarMathDelimiters(text) {
    let result = '';
    let inDollarMath = false;
    let inLatexMath = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];
        const prev = text[i - 1];

        // Track \( and \[
        if (char === '\\' && (next === '(' || next === '[')) {
            inLatexMath = true;
            result += char + next;
            i++;
            continue;
        }

        // Track \) and \]
        if (char === '\\' && (next === ')' || next === ']')) {
            inLatexMath = false;
            result += char + next;
            i++;
            continue;
        }

        if (char === '\\' && next === '$') {
            if (inDollarMath || inLatexMath) {
                result += '\\$';
            } else {
                result += CURRENCY_TOKEN;
            }
            i++;
            continue;
        }

        if (char === '$' && prev !== '\\') {
            if (next === '$') {
                result += '$$';
                i++;
                continue;
            }

            inDollarMath = !inDollarMath;
            result += char;
            continue;
        }

        result += char;
    }

    return result;
}

/**
 * Restore LaTeX commands that were corrupted by JSON escape sequences.
 * When AI generates \frac in a JSON string, \f becomes form feed char (U+000C).
 * Similarly \t→tab, \b→backspace, \n→newline, \r→CR.
 * This function detects control chars followed by known LaTeX suffixes
 * and restores the proper backslash+letter combination.
 */
function restoreCorruptedLatex(text) {
    // Each entry: [control char, the letter it represents, suffixes that form valid LaTeX commands]
    const corruptions = [
        ['\f', 'f', ['rac', 'loor', 'orall', 'lat']],
        ['\b', 'b', ['egin', 'inom', 'ar', 'eta', 'ig', 'igg', 'oldsymbol', 'oxed', 'f']],
        ['\t', 't', ['ext', 'an', 'heta', 'imes', 'o', 'riangle', 'extstyle', 'ilde', 'ag']],
        ['\n', 'n', ['abla', 'eq', 'ewline', 'ot', 'u', 'e', 'atural']],
        ['\r', 'r', ['ight', 'ightarrow', 'Rightarrow', 'ange', 'angle', 'adius', 'ho', 'vert']],
    ];

    let result = text;
    for (const [ctrlChar, letter, suffixes] of corruptions) {
        // Sort suffixes by length descending to match longest first
        const sorted = [...suffixes].sort((a, b) => b.length - a.length);
        for (const suffix of sorted) {
            // Split+join is safe for multiple occurrences
            result = result.split(ctrlChar + suffix).join('\\' + letter + suffix);
        }
    }
    return result;
}

/**
 * Find LaTeX commands that are NOT inside $...$ delimiters and wrap them.
 * Also detects bare subscripts/superscripts like a_n, x^2, a_{n+1}
 */
function wrapBareLatex(text) {
    // First, identify all regions that are already inside $...$
    const mathRegions = [];
    let i = 0;
    while (i < text.length) {
        if (text[i] === '$') {
            if (text[i + 1] === '$') {
                // Display math $$...$$
                const end = text.indexOf('$$', i + 2);
                if (end !== -1) {
                    mathRegions.push({ start: i, end: end + 2 });
                    i = end + 2;
                    continue;
                }
            }
            // Inline math $...$
            const end = text.indexOf('$', i + 1);
            if (end !== -1) {
                mathRegions.push({ start: i, end: end + 1 });
                i = end + 1;
                continue;
            }
        } else if (text[i] === '\\') {
            if (text[i + 1] === '[') {
                // Block math \[...\]
                const end = text.indexOf('\\]', i + 2);
                if (end !== -1) {
                    mathRegions.push({ start: i, end: end + 2 });
                    i = end + 2;
                    continue;
                }
            } else if (text[i + 1] === '(') {
                // Inline math \(...\)
                const end = text.indexOf('\\)', i + 2);
                if (end !== -1) {
                    mathRegions.push({ start: i, end: end + 2 });
                    i = end + 2;
                    continue;
                }
            }
        }
        i++;
    }

    // Check if a position is inside a math region
    function isInMath(pos) {
        return mathRegions.some(r => pos >= r.start && pos < r.end);
    }

    // Find bare LaTeX commands and wrap them in $...$
    // We need to find contiguous LaTeX expressions
    let result = '';
    let lastEnd = 0;

    // Pattern to find LaTeX-like sequences outside math delimiters
    // Matches: \command{...} or \command followed by ^, _, {, etc.
    // Also matches: a_n, x^2, a_{n+1} (bare subscripts/superscripts)
    // Also matches: a_n = \frac{...}{...} (combined expressions)
    const barePattern = /\\(?:frac|sqrt|sum|prod|int|lim|log|ln|sin|cos|tan|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi|infty|partial|nabla|leq|geq|neq|approx|times|cdot|div|mathbb|angle|triangle|overline|binom|pm|begin|end|left|right|text|mathrm|Big|big|Bigg|bigg|to|rightarrow|Rightarrow)(?:\[[^\]]*\])?(?:\{[^}]*\})*(?:[_^]\{[^}]*\})*(?:\{[^}]*\})*(?:\s*[+\-=<>]\s*\\?[a-zA-Z{}\d_^\\]*)*|[a-zA-Z][_^](?:\{[^}]+\}|[a-zA-Z0-9])(?:\s*=\s*\\[a-zA-Z]+(?:\{[^}]*\})*(?:[_^]\{[^}]*\})*)?|[a-zA-Z]_[{]?[a-zA-Z0-9+\-]+[}]?\s*=\s*\\[a-zA-Z]+/g;

    let match;
    const replacements = [];

    barePattern.lastIndex = 0;
    while ((match = barePattern.exec(text)) !== null) {
        if (!isInMath(match.index)) {
            replacements.push({
                start: match.index,
                end: match.index + match[0].length,
                original: match[0],
            });
        }
    }

    // Apply replacements in reverse to maintain positions
    if (replacements.length === 0) return text;

    let chars = text.split('');
    // Group adjacent bare LaTeX into single expressions
    const groups = [];
    let currentGroup = null;

    for (const rep of replacements) {
        if (currentGroup && rep.start - currentGroup.end <= 3) {
            // Extend current group
            currentGroup.end = rep.end;
        } else {
            if (currentGroup) groups.push(currentGroup);
            currentGroup = { start: rep.start, end: rep.end };
        }
    }
    if (currentGroup) groups.push(currentGroup);

    // Build result with wrapped LaTeX
    result = '';
    lastEnd = 0;
    for (const group of groups) {
        result += text.substring(lastEnd, group.start);
        const expr = text.substring(group.start, group.end).trim();
        // Only wrap if not already wrapped
        if (!expr.startsWith('$')) {
            result += '$' + expr + '$';
        } else {
            result += expr;
        }
        lastEnd = group.end;
    }
    result += text.substring(lastEnd);

    return result;
}

/**
 * Clean {,} patterns to regular commas when outside of $...$ delimiters.
 */
function cleanCommasOutsideMath(text) {
    let result = '';
    let inMath = false;
    let i = 0;

    while (i < text.length) {
        if (text[i] === '$') {
            inMath = !inMath;
            result += text[i];
            i++;
            continue;
        }

        if (!inMath && text[i] === '{' && text[i + 1] === ',' && text[i + 2] === '}') {
            result += ',';
            i += 3;
            continue;
        }

        result += text[i];
        i++;
    }

    return result;
}

// ──────────────────────────────────────────────────
// RENDERING: Convert text with LaTeX delimiters to HTML
// ──────────────────────────────────────────────────

/**
 * Convierte un string con delimitadores LaTeX en HTML con KaTeX renderizado.
 */
function renderMathText(input) {
    if (!input) return '';

    let result = '';
    let i = 0;
    const str = String(input);

    while (i < str.length) {
        // HTML tags (from markdown conversion): pass through
        if (str[i] === '<' && (str.substring(i).startsWith('<strong>') || str.substring(i).startsWith('</strong>') || str.substring(i).startsWith('<em>') || str.substring(i).startsWith('</em>'))) {
            const tagEnd = str.indexOf('>', i);
            if (tagEnd !== -1) {
                result += str.substring(i, tagEnd + 1);
                i = tagEnd + 1;
                continue;
            }
        }

        // Display math: $$...$$
        if (str[i] === '$' && str[i + 1] === '$') {
            const end = str.indexOf('$$', i + 2);
            if (end !== -1) {
                const latex = str.substring(i + 2, end);
                result += renderKatex(latex, true);
                i = end + 2;
                continue;
            }
        }

        // Display math: \[...\]
        if (str[i] === '\\' && str[i + 1] === '[') {
            const end = str.indexOf('\\]', i + 2);
            if (end !== -1) {
                const latex = str.substring(i + 2, end);
                result += renderKatex(latex, true);
                i = end + 2;
                continue;
            }
        }

        // Inline math: $...$  (but not $$)
        if (str[i] === '$' && str[i + 1] !== '$') {
            const end = str.indexOf('$', i + 1);
            if (end !== -1 && end > i + 1) {
                const latex = str.substring(i + 1, end);
                result += renderKatex(latex, false);
                i = end + 1;
                continue;
            }
        }

        // Inline math: \(...\)
        if (str[i] === '\\' && str[i + 1] === '(') {
            const end = str.indexOf('\\)', i + 2);
            if (end !== -1) {
                const latex = str.substring(i + 2, end);
                result += renderKatex(latex, false);
                i = end + 2;
                continue;
            }
        }

        // Regular character
        result += escapeHtml(str[i]);
        i++;
    }

    return result;
}

function renderKatex(latex, displayMode) {
    const preparedLatex = normalizeLatexForKatex(latex);
    try {
        return katex.renderToString(preparedLatex, {
            displayMode,
            throwOnError: true,
            strict: false,
            trust: true,
        });
    } catch {
        return `<span class="math-fallback">${escapeHtml(cleanLatexFallback(latex))}</span>`;
    }
}

function normalizeLatexForKatex(latex) {
    return String(latex || '')
        .trim()
        .replace(/×/g, '\\times ')
        .replace(/\\+%/g, '\\%')
        .replace(/(^|[^\\])%/g, '$1\\%')
        .replace(/\\sqrt\s*([0-9]+(?:[,.][0-9]+)?|[a-zA-Z])(?![a-zA-Z])/g, '\\sqrt{$1}')
        .replace(/\\frac\s*(?=\\(?:pm|mp|sqrt|times|cdot|div)\b)/g, '');
}

function cleanLatexFallback(latex) {
    return normalizeLatexForKatex(latex)
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
        .replace(/\\sqrt\{([^{}]+)\}/g, '√$1')
        .replace(/\\pm/g, '±')
        .replace(/\\mp/g, '∓')
        .replace(/\\times/g, '×')
        .replace(/\\cdot/g, '·')
        .replace(/\\div/g, '÷')
        .replace(/\\%/g, '%')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderTikzBlock(tikzCode, finalCode) {
    const pgfplotsSvg = renderPgfplotsSvg(tikzCode);
    if (pgfplotsSvg) return pgfplotsSvg;

    const simpleSvg = renderSimpleTikzSvg(tikzCode);
    if (simpleSvg) return simpleSvg;

    return `
    <div class="tikz-holder my-4" data-code="${escapeHtml(finalCode)}" style="display:flex; justify-content:center; align-items:center; min-height:160px; margin:1rem 0;">
        <div style="border:1px solid rgba(156,163,175,0.28); border-radius:8px; padding:1rem; color:var(--text-secondary); background:rgba(255,255,255,0.03);">
            Renderizando figura LaTeX...
        </div>
    </div>`;
}

function renderPgfplotsSvg(tikzCode) {
    const axisMatch = tikzCode.match(/\\begin\{axis\}\[([\s\S]*?)\]([\s\S]*?)\\end\{axis\}/);
    if (!axisMatch) return null;

    const options = parseAxisOptions(axisMatch[1]);
    const body = axisMatch[2];
    const plots = parseAddPlots(body);
    if (plots.length === 0) return null;

    const isXBar = /\bxbar\b/.test(axisMatch[1]);
    const isYBar = /\bybar\b/.test(axisMatch[1]) || (!isXBar && plots.some(p => p.options.includes('ybar')));
    const isComb = /ycomb/.test(body);
    const width = 520;
    const height = 320;
    const margin = { left: 62, right: 28, top: 24, bottom: 68 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const colors = ['#f97316', '#60a5fa', '#a78bfa', '#34d399', '#f59e0b'];

    const categories = buildCategories(options, plots, isXBar);
    if (categories.length === 0) return null;

    const numericValues = [];
    plots.forEach(plot => plot.points.forEach(point => numericValues.push(isXBar ? point.xNum : point.yNum)));
    if (numericValues.length === 0) return null;

    const explicitMin = isXBar ? toNumber(options.xmin) : toNumber(options.ymin);
    const explicitMax = isXBar ? toNumber(options.xmax) : toNumber(options.ymax);
    const dataMin = Math.min(0, ...numericValues);
    const dataMax = Math.max(...numericValues, 1);
    const minValue = Number.isFinite(explicitMin) ? explicitMin : dataMin;
    const maxValue = Number.isFinite(explicitMax) ? explicitMax : niceMax(dataMax);
    const range = maxValue - minValue || 1;

    const axisColor = 'rgba(229,231,235,0.78)';
    const gridColor = 'rgba(156,163,175,0.22)';
    const textColor = 'rgba(245,245,245,0.9)';
    const mutedText = 'rgba(212,212,216,0.78)';

    const ticks = buildTicks(minValue, maxValue, 5);
    const grid = ticks.map(tick => {
        if (isXBar) {
            const x = margin.left + ((tick - minValue) / range) * plotW;
            return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotH}" stroke="${gridColor}" stroke-width="1" />
                <text x="${x}" y="${height - 42}" text-anchor="middle" fill="${mutedText}" font-size="11">${formatAxisNumber(tick)}</text>`;
        }
        const y = margin.top + plotH - ((tick - minValue) / range) * plotH;
        return `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotW}" y2="${y}" stroke="${gridColor}" stroke-width="1" />
            <text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="${mutedText}" font-size="11">${formatAxisNumber(tick)}</text>`;
    }).join('');

    let series = '';
    if (isYBar || isXBar) {
        series = renderBarSeries({ plots, categories, isXBar, margin, plotW, plotH, minValue, range, colors });
    } else if (isComb) {
        series = renderCombSeries({ plots, categories, margin, plotW, plotH, minValue, range, colors });
    } else {
        series = renderLineSeries({ plots, categories, margin, plotW, plotH, minValue, range, colors });
    }

    const categoryLabels = categories.map((cat, idx) => {
        if (isXBar) {
            const y = margin.top + ((idx + 0.5) / categories.length) * plotH;
            return `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" fill="${textColor}" font-size="11">${escapeHtml(shortLabel(cat))}</text>`;
        }
        const x = margin.left + ((idx + 0.5) / categories.length) * plotW;
        return `<text x="${x}" y="${height - 28}" text-anchor="middle" fill="${textColor}" font-size="11">${escapeHtml(shortLabel(cat))}</text>`;
    }).join('');

    const labels = `
        ${options.xlabel ? `<text x="${margin.left + plotW / 2}" y="${height - 8}" text-anchor="middle" fill="${mutedText}" font-size="12">${escapeHtml(cleanLatexLabel(options.xlabel))}</text>` : ''}
        ${options.ylabel && !isXBar ? `<text transform="translate(16 ${margin.top + plotH / 2}) rotate(-90)" text-anchor="middle" fill="${mutedText}" font-size="12">${escapeHtml(cleanLatexLabel(options.ylabel))}</text>` : ''}
    `;

    return `
    <div class="latex-figure-wrap" style="display:flex; justify-content:center; width:100%; margin:1.25rem 0; overflow-x:auto;">
        <svg role="img" aria-label="Gráfica generada desde LaTeX" viewBox="0 0 ${width} ${height}" style="width:min(100%, ${width}px); height:auto; background:rgba(255,255,255,0.025); border:1px solid rgba(156,163,175,0.22); border-radius:8px;">
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent" />
            ${grid}
            <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="${axisColor}" stroke-width="1.25" />
            <line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" stroke="${axisColor}" stroke-width="1.25" />
            ${series}
            ${categoryLabels}
            ${labels}
        </svg>
    </div>`;
}

function parseAxisOptions(optionsText) {
    const options = {};
    splitTopLevel(optionsText, ',').forEach(part => {
        const [rawKey, ...rest] = part.split('=');
        const key = rawKey?.trim();
        if (!key) return;
        const value = rest.join('=').trim();
        options[key] = stripOuterBraces(value || 'true');
    });
    return options;
}

function splitTopLevel(text, separator = ',') {
    const parts = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const prev = text[i - 1];
        if (char === '{' && prev !== '\\') depth++;
        if (char === '}' && prev !== '\\') depth = Math.max(0, depth - 1);
        if (char === separator && depth === 0) {
            parts.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) parts.push(current);
    return parts;
}

function stripOuterBraces(value) {
    const trimmed = String(value || '').trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function parseAddPlots(body) {
    const plots = [];
    const regex = /\\addplot\+?(?:\[([\s\S]*?)\])?\s*coordinates\s*\{([\s\S]*?)\}\s*;/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
        const points = [];
        const coords = match[2];
        const coordRegex = /\(([^()]+),([^()]+)\)/g;
        let coordMatch;
        while ((coordMatch = coordRegex.exec(coords)) !== null) {
            const rawX = cleanLatexLabel(coordMatch[1]);
            const rawY = cleanLatexLabel(coordMatch[2]);
            points.push({
                x: rawX,
                y: rawY,
                xNum: toNumber(rawX),
                yNum: toNumber(rawY),
            });
        }
        if (points.length > 0) {
            plots.push({ options: match[1] || '', points });
        }
    }
    return plots;
}

function buildCategories(options, plots, isXBar) {
    const symbolic = isXBar ? options['symbolic y coords'] : options['symbolic x coords'];
    if (symbolic) return splitTopLevel(symbolic, ',').map(cleanLatexLabel).filter(Boolean);

    const set = new Set();
    plots.forEach(plot => {
        plot.points.forEach(point => {
            const label = isXBar ? point.y : point.x;
            set.add(label);
        });
    });
    return [...set];
}

function renderBarSeries({ plots, categories, isXBar, margin, plotW, plotH, minValue, range, colors }) {
    const groupCount = categories.length;
    const seriesCount = plots.length;
    const zeroRatio = (0 - minValue) / range;
    const zeroX = margin.left + Math.max(0, Math.min(1, zeroRatio)) * plotW;
    const zeroY = margin.top + plotH - Math.max(0, Math.min(1, zeroRatio)) * plotH;

    return plots.map((plot, plotIdx) => {
        const color = colors[plotIdx % colors.length];
        return plot.points.map(point => {
            const category = isXBar ? point.y : point.x;
            const catIdx = categories.indexOf(category);
            if (catIdx === -1) return '';
            const value = isXBar ? point.xNum : point.yNum;
            if (!Number.isFinite(value)) return '';

            if (isXBar) {
                const bandH = plotH / groupCount;
                const barH = Math.max(5, (bandH * 0.72) / seriesCount);
                const y = margin.top + catIdx * bandH + (bandH - barH * seriesCount) / 2 + plotIdx * barH;
                const xVal = margin.left + ((value - minValue) / range) * plotW;
                const x = Math.min(zeroX, xVal);
                const w = Math.max(2, Math.abs(xVal - zeroX));
                return `<rect x="${x}" y="${y}" width="${w}" height="${barH}" rx="2" fill="${color}" opacity="0.86" />`;
            }

            const bandW = plotW / groupCount;
            const barW = Math.max(5, (bandW * 0.72) / seriesCount);
            const x = margin.left + catIdx * bandW + (bandW - barW * seriesCount) / 2 + plotIdx * barW;
            const yVal = margin.top + plotH - ((value - minValue) / range) * plotH;
            const y = Math.min(zeroY, yVal);
            const h = Math.max(2, Math.abs(zeroY - yVal));
            return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="2" fill="${color}" opacity="0.86" />`;
        }).join('');
    }).join('');
}

function renderLineSeries({ plots, categories, margin, plotW, plotH, minValue, range, colors }) {
    return plots.map((plot, plotIdx) => {
        const color = colors[plotIdx % colors.length];
        const points = plot.points.map(point => {
            const catIdx = categories.includes(point.x) ? categories.indexOf(point.x) : null;
            const xValue = catIdx !== null ? catIdx + 0.5 : point.xNum;
            const xMin = Number.isFinite(point.xNum) && !categories.includes(point.x) ? Math.min(...plot.points.map(p => p.xNum).filter(Number.isFinite)) : 0;
            const xMax = Number.isFinite(point.xNum) && !categories.includes(point.x) ? Math.max(...plot.points.map(p => p.xNum).filter(Number.isFinite)) : categories.length;
            const x = categories.includes(point.x)
                ? margin.left + ((xValue) / categories.length) * plotW
                : margin.left + ((point.xNum - xMin) / ((xMax - xMin) || 1)) * plotW;
            const y = margin.top + plotH - ((point.yNum - minValue) / range) * plotH;
            return { x, y };
        }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

        const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
        const circles = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" />`).join('');
        return `<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.5" />${circles}`;
    }).join('');
}

function renderCombSeries(args) {
    const { plots, categories, margin, plotW, plotH, minValue, range, colors } = args;
    return plots.map((plot, plotIdx) => {
        const color = colors[plotIdx % colors.length];
        return plot.points.map(point => {
            const catIdx = categories.includes(point.x) ? categories.indexOf(point.x) : point.xNum - 1;
            const x = margin.left + ((catIdx + 0.5) / categories.length) * plotW;
            const y = margin.top + plotH - ((point.yNum - minValue) / range) * plotH;
            const baseY = margin.top + plotH - ((0 - minValue) / range) * plotH;
            return `<line x1="${x}" y1="${baseY}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="2" /><circle cx="${x}" cy="${y}" r="3" fill="${color}" />`;
        }).join('');
    }).join('');
}

function renderSimpleTikzSvg(tikzCode) {
    const bodyMatch = tikzCode.match(/\\begin\{tikzpicture\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{tikzpicture\}/);
    if (!bodyMatch) return null;
    const body = bodyMatch[1];
    if (/\\begin\{axis\}/.test(body)) return null;

    const coordinates = {};
    const points = [];
    const coordRegex = /\\coordinate\s*\(([^)]+)\)\s*at\s*\(([-\d.,]+)\s*,\s*([-\d.,]+)\)\s*;/g;
    let match;
    while ((match = coordRegex.exec(body)) !== null) {
        coordinates[match[1]] = { x: toNumber(match[2]), y: toNumber(match[3]) };
        points.push(coordinates[match[1]]);
    }

    const lines = [];
    const drawRegex = /\\(?:draw|filldraw)(?:\[[^\]]*\])?\s*([^;]+);/g;
    while ((match = drawRegex.exec(body)) !== null) {
        const command = match[1];
        const circle = command.match(/\(([-\d.,]+)\s*,\s*([-\d.,]+)\)\s+circle\s*\(([-\d.,]+)/);
        if (circle) {
            const p = { x: toNumber(circle[1]), y: toNumber(circle[2]) };
            points.push(p);
            lines.push({ type: 'circle', p, r: Math.abs(toNumber(circle[3]) || 0.2) });
            continue;
        }

        const pathPoints = [];
        const pathRegex = /\(([^)]+)\)/g;
        let pointMatch;
        while ((pointMatch = pathRegex.exec(command)) !== null) {
            const raw = pointMatch[1].trim();
            let p = coordinates[raw];
            if (!p && raw.includes(',')) {
                const [x, y] = raw.split(',');
                p = { x: toNumber(x), y: toNumber(y) };
            }
            if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                pathPoints.push(p);
                points.push(p);
            }
        }
        if (pathPoints.length >= 2) lines.push({ type: 'polyline', points: pathPoints });
    }

    const fills = [];
    const fillRegex = /\\fill(?:\[[^\]]*\])?\s*\(([-\d.,]+)\s*,\s*([-\d.,]+)\)\s+circle\s*\(([-\d.,]+)/g;
    while ((match = fillRegex.exec(body)) !== null) {
        const p = { x: toNumber(match[1]), y: toNumber(match[2]) };
        points.push(p);
        fills.push({ p, r: Math.abs(toNumber(match[3]) || 0.08) });
    }

    const nodes = [];
    const nodeRegex = /\\node(?:\[[^\]]*\])?\s+at\s+\(([^)]+)\)\s*\{([\s\S]*?)\}\s*;/g;
    while ((match = nodeRegex.exec(body)) !== null) {
        const raw = match[1].trim();
        let p = coordinates[raw];
        if (!p && raw.includes(',')) {
            const [x, y] = raw.split(',');
            p = { x: toNumber(x), y: toNumber(y) };
        }
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            points.push(p);
            nodes.push({ p, text: cleanLatexLabel(match[2]) });
        }
    }

    if (points.length === 0 || (lines.length === 0 && nodes.length === 0 && fills.length === 0)) return null;

    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const width = 480;
    const height = 260;
    const pad = 34;
    const scaleX = (width - pad * 2) / ((maxX - minX) || 1);
    const scaleY = (height - pad * 2) / ((maxY - minY) || 1);
    const scale = Math.min(scaleX, scaleY);
    const tx = (x) => pad + (x - minX) * scale + ((width - pad * 2) - (maxX - minX) * scale) / 2;
    const ty = (y) => height - pad - (y - minY) * scale - ((height - pad * 2) - (maxY - minY) * scale) / 2;

    const lineSvg = lines.map(line => {
        if (line.type === 'circle') {
            return `<circle cx="${tx(line.p.x)}" cy="${ty(line.p.y)}" r="${Math.max(3, line.r * scale)}" fill="none" stroke="rgba(245,245,245,0.86)" stroke-width="2" />`;
        }
        const pts = line.points.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');
        return `<polyline points="${pts}" fill="none" stroke="rgba(245,245,245,0.86)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
    }).join('');
    const fillSvg = fills.map(fill => `<circle cx="${tx(fill.p.x)}" cy="${ty(fill.p.y)}" r="${Math.max(2, fill.r * scale)}" fill="#f97316" />`).join('');
    const nodeSvg = nodes.map(node => `<text x="${tx(node.p.x)}" y="${ty(node.p.y)}" fill="rgba(245,245,245,0.9)" font-size="12" text-anchor="middle">${escapeHtml(shortLabel(node.text, 18))}</text>`).join('');

    return `
    <div class="latex-figure-wrap" style="display:flex; justify-content:center; width:100%; margin:1.25rem 0; overflow-x:auto;">
        <svg role="img" aria-label="Figura generada desde LaTeX" viewBox="0 0 ${width} ${height}" style="width:min(100%, ${width}px); height:auto; background:rgba(255,255,255,0.025); border:1px solid rgba(156,163,175,0.22); border-radius:8px;">
            ${lineSvg}
            ${fillSvg}
            ${nodeSvg}
        </svg>
    </div>`;
}

function cleanLatexLabel(value) {
    return normalizeLatexSource(value)
        .replace(/\\textbf\{([\s\S]*?)\}/g, '$1')
        .replace(/\\textit\{([\s\S]*?)\}/g, '$1')
        .replace(/\\mathrm\{([\s\S]*?)\}/g, '$1')
        .replace(/\\makecell\{([\s\S]*?)\}/g, '$1')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}$]/g, '')
        .replaceAll(CURRENCY_TOKEN, '$')
        .replaceAll(THINSPACE_TOKEN, ' ')
        .trim();
}

function toNumber(value) {
    if (typeof value === 'number') return value;
    const cleaned = cleanLatexLabel(value)
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.\-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function niceMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / pow) * pow;
}

function buildTicks(minValue, maxValue, count) {
    const ticks = [];
    const step = (maxValue - minValue) / count;
    for (let i = 0; i <= count; i++) ticks.push(minValue + step * i);
    return ticks;
}

function formatAxisNumber(value) {
    if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('es-CO');
    if (Math.abs(value) < 1 && value !== 0) return value.toFixed(2).replace('.', ',');
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function shortLabel(label, max = 12) {
    const clean = cleanLatexLabel(label);
    return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function parseLatexTable(alignSpec, tableContent) {
    const colAligns = parseAlignSpec(alignSpec);
    const prepared = prepareTableContent(tableContent);
    const rawRows = splitLatexRows(prepared);
    const htmlRows = [];

    rawRows.forEach((rawRow, rowIdx) => {
        let rowText = rawRow
            .replace(/\\(?:hline|cline\{[^}]*\})/g, '')
            .replace(/\\(?:scriptsize|footnotesize|small|normalsize|large|Large)\b/g, '')
            .trim();
        if (!rowText) return;

        let rowStyle = 'border-bottom: 1px solid rgba(156, 163, 175, 0.25);';
        const colorMatch = rowText.match(/\\rowcolor\{([a-zA-Z0-9_!]+)\}/);
        if (colorMatch) {
            const colorName = colorMatch[1];
            rowText = rowText.replace(/\\rowcolor\{.*?\}/g, '').trim();
            rowStyle += colorName.toLowerCase().includes('azul') || colorName.toLowerCase().includes('claro')
                ? ' background-color: rgba(59, 130, 246, 0.12);'
                : ' background-color: rgba(156, 163, 175, 0.1);';
        }

        const isHeader = rowIdx === 0 || /\\textbf\{/.test(rowText);
        if (isHeader && !colorMatch) {
            rowStyle += ' background-color: rgba(156, 163, 175, 0.12);';
        }

        const rawCells = splitLatexCells(rowText);
        const cellsHtml = rawCells
            .map((rawCell, colIdx) => renderTableCell(rawCell, colAligns[colIdx] || 'center', isHeader))
            .filter(Boolean);

        if (cellsHtml.length > 0) {
            htmlRows.push(`<tr style="${rowStyle}">${cellsHtml.join('')}</tr>`);
        }
    });

    if (htmlRows.length === 0) return '';

    return `
    <div class="latex-table-wrap" style="display:flex; justify-content:center; margin:1.25rem 0; width:100%; overflow-x:auto;">
        <table class="latex-table" style="border:1px solid rgba(156,163,175,0.32); border-collapse:collapse; border-radius:8px; overflow:hidden; max-width:100%; font-size:0.92em;">
            <tbody>${htmlRows.join('')}</tbody>
        </table>
    </div>
    `;
}

function parseAlignSpec(alignSpec) {
    const aligns = [];
    const spec = String(alignSpec || '').replace(/\|/g, '');
    for (let i = 0; i < spec.length; i++) {
        const char = spec[i];
        if (char === 'l') aligns.push('left');
        if (char === 'r') aligns.push('right');
        if (char === 'c') aligns.push('center');
        if (char === 'p') {
            aligns.push('left');
            if (spec[i + 1] === '{') {
                const group = readBalancedGroup(spec, i + 1);
                if (group) i = group.end - 1;
            }
        }
    }
    return aligns.length > 0 ? aligns : ['center'];
}

function prepareTableContent(content) {
    let text = normalizeLatexSource(content)
        .replace(/%[^\n]*/g, '')
        .replace(/\\makecell(?:\[[^\]]*\])?\{([\s\S]*?)\}/g, (_, inner) => inner.replace(/\\\\/g, LINEBREAK_TOKEN))
        .replace(/\\multirow\{[^}]*\}\{[^}]*\}\{([\s\S]*?)\}/g, '$1')
        .replace(/\\multicolumn\{[^}]*\}\{[^}]*\}\{([\s\S]*?)\}/g, '$1');

    return text;
}

function splitLatexRows(content) {
    const rows = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const prev = content[i - 1];
        if (char === '{' && prev !== '\\') depth++;
        if (char === '}' && prev !== '\\') depth = Math.max(0, depth - 1);

        if (char === '\\' && content[i + 1] === '\\' && depth === 0) {
            rows.push(current);
            current = '';
            i++;
            continue;
        }

        current += char;
    }

    if (current.trim()) rows.push(current);
    return rows;
}

function splitLatexCells(row) {
    const cells = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const prev = row[i - 1];
        if (char === '{' && prev !== '\\') depth++;
        if (char === '}' && prev !== '\\') depth = Math.max(0, depth - 1);

        if (char === '&' && prev !== '\\' && depth === 0) {
            cells.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    cells.push(current);
    return cells;
}

function renderTableCell(rawCell, align, isHeader) {
    let cellText = normalizeTableCell(rawCell);
    if (!cellText) return '';

    const tag = isHeader ? 'th' : 'td';
    const cellStyle = [
        `text-align:${align}`,
        'padding:10px 14px',
        'border:1px solid rgba(156,163,175,0.28)',
        'vertical-align:middle',
        isHeader ? 'font-weight:700' : '',
    ].filter(Boolean).join(';');

    const renderedCellContent = restoreLiteralTokens(renderMathText(sanitizeLatex(cellText)));
    return `<${tag} style="${cellStyle}">${renderedCellContent}</${tag}>`;
}

function normalizeTableCell(rawCell) {
    let cell = normalizeLatexSource(rawCell)
        .replace(/\\&/g, '&')
        .replace(/\\(?:hline|cline\{[^}]*\})/g, '')
        .replace(/\\(?:scriptsize|footnotesize|small|normalsize|large|Large)\b/g, '')
        .trim();

    cell = replaceLatexTextCommand(cell, 'textbf', (inner) => `<strong>${inner}</strong>`);
    cell = replaceLatexTextCommand(cell, 'textit', (inner) => `<em>${inner}</em>`);
    cell = replaceLatexTextCommand(cell, 'emph', (inner) => `<em>${inner}</em>`);

    return cell.trim();
}

function replaceLatexTextCommandsOutsideMath(text) {
    let result = '';
    let pos = 0;

    while (pos < text.length) {
        const mathStart = findNextMathDelimiter(text, pos);
        if (!mathStart) {
            result += formatLatexTextCommands(text.substring(pos));
            break;
        }

        result += formatLatexTextCommands(text.substring(pos, mathStart.start));
        result += text.substring(mathStart.start, mathStart.end);
        pos = mathStart.end;
    }

    return result;
}

function findNextMathDelimiter(text, fromIndex) {
    const candidates = [];
    const dollar = text.indexOf('$', fromIndex);
    const inlineParen = text.indexOf('\\(', fromIndex);
    const displayBracket = text.indexOf('\\[', fromIndex);

    if (dollar !== -1) {
        const token = text[dollar + 1] === '$' ? '$$' : '$';
        const end = text.indexOf(token, dollar + token.length);
        if (end !== -1) candidates.push({ start: dollar, end: end + token.length });
    }

    if (inlineParen !== -1) {
        const end = text.indexOf('\\)', inlineParen + 2);
        if (end !== -1) candidates.push({ start: inlineParen, end: end + 2 });
    }

    if (displayBracket !== -1) {
        const end = text.indexOf('\\]', displayBracket + 2);
        if (end !== -1) candidates.push({ start: displayBracket, end: end + 2 });
    }

    candidates.sort((a, b) => a.start - b.start);
    return candidates[0] || null;
}

function formatLatexTextCommands(text) {
    let formatted = replaceLatexTextCommand(text, 'textbf', (inner) => `<strong>${inner}</strong>`);
    formatted = replaceLatexTextCommand(formatted, 'textit', (inner) => `<em>${inner}</em>`);
    formatted = replaceLatexTextCommand(formatted, 'emph', (inner) => `<em>${inner}</em>`);
    return formatted;
}

function replaceLatexTextCommand(text, command, formatter) {
    const token = `\\${command}`;
    let result = '';
    let pos = 0;

    while (pos < text.length) {
        const start = text.indexOf(token, pos);
        if (start === -1) {
            result += text.substring(pos);
            break;
        }

        result += text.substring(pos, start);
        let cursor = start + token.length;
        while (/\s/.test(text[cursor] || '')) cursor++;
        const group = readBalancedGroup(text, cursor);
        if (!group) {
            result += token;
            pos = cursor;
            continue;
        }

        result += formatter(group.content);
        pos = group.end;
    }

    return result;
}
