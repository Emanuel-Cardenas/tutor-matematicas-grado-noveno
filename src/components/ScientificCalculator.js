'use client';
import { useState, useCallback } from 'react';

export default function ScientificCalculator() {
    const [isOpen, setIsOpen] = useState(false);
    const [display, setDisplay] = useState('0');
    const [expression, setExpression] = useState('');
    const [memory, setMemory] = useState(0);
    const [history, setHistory] = useState([]);
    const [isScientific, setIsScientific] = useState(true);
    const [isDeg, setIsDeg] = useState(true);
    const [lastResult, setLastResult] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    const toRad = (val) => isDeg ? (val * Math.PI / 180) : val;
    const fromRad = (val) => isDeg ? (val * 180 / Math.PI) : val;

    const handleNumber = useCallback((num) => {
        if (display === '0' && num !== '.') {
            setDisplay(String(num));
        } else if (num === '.' && display.includes('.')) {
            return;
        } else {
            setDisplay(display + num);
        }
        setLastResult(null);
    }, [display]);

    const handleOperator = useCallback((op) => {
        const symbols = { '+': ' + ', '-': ' - ', '×': ' × ', '÷': ' ÷ ', '^': ' ^ ' };
        if (lastResult !== null) {
            setExpression(display + (symbols[op] || ` ${op} `));
        } else {
            setExpression(expression + display + (symbols[op] || ` ${op} `));
        }
        setDisplay('0');
        setLastResult(null);
    }, [display, expression, lastResult]);

    const handleParenthesis = useCallback((p) => {
        if (p === '(') {
            setExpression(expression + (display !== '0' ? display + ' × ' : '') + '(');
            setDisplay('0');
        } else {
            setExpression(expression + display + ')');
            setDisplay('0');
        }
    }, [display, expression]);

    const handleScientific = useCallback((func) => {
        const val = parseFloat(display);
        if (isNaN(val)) return;

        let result;
        try {
            switch (func) {
                case 'sin': result = Math.sin(toRad(val)); break;
                case 'cos': result = Math.cos(toRad(val)); break;
                case 'tan': result = Math.tan(toRad(val)); break;
                case 'asin': result = fromRad(Math.asin(val)); break;
                case 'acos': result = fromRad(Math.acos(val)); break;
                case 'atan': result = fromRad(Math.atan(val)); break;
                case 'log': result = Math.log10(val); break;
                case 'ln': result = Math.log(val); break;
                case 'sqrt': result = Math.sqrt(val); break;
                case 'cbrt': result = Math.cbrt(val); break;
                case 'x2': result = val * val; break;
                case 'x3': result = val * val * val; break;
                case 'inv': result = 1 / val; break;
                case 'abs': result = Math.abs(val); break;
                case 'exp': result = Math.exp(val); break;
                case '10x': result = Math.pow(10, val); break;
                case 'fact':
                    if (val < 0 || val > 170 || !Number.isInteger(val)) { result = NaN; break; }
                    result = 1;
                    for (let i = 2; i <= val; i++) result *= i;
                    break;
                default: return;
            }
            const formatted = formatResult(result);
            setDisplay(formatted);
            setLastResult(result);
        } catch {
            setDisplay('Error');
        }
    }, [display, isDeg]);

    const handleConstant = useCallback((c) => {
        if (c === 'pi') setDisplay(String(Math.PI));
        if (c === 'e') setDisplay(String(Math.E));
        setLastResult(null);
    }, []);

    const handleEquals = useCallback(() => {
        try {
            const fullExpr = expression + display;
            const evalExpr = fullExpr
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/\^/g, '**');
            const result = Function('"use strict"; return (' + evalExpr + ')')();
            const formatted = formatResult(result);

            setHistory(prev => {
                const newH = [{ expr: fullExpr, result: formatted }, ...prev];
                return newH.slice(0, 8);
            });
            setDisplay(formatted);
            setExpression('');
            setLastResult(result);
        } catch {
            setDisplay('Error');
            setExpression('');
        }
    }, [display, expression]);

    const handleClear = () => { setDisplay('0'); setExpression(''); setLastResult(null); };
    const handleCE = () => { setDisplay('0'); setLastResult(null); };
    const handleBackspace = () => {
        setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
    };
    const handleToggleSign = () => {
        setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display);
    };
    const handlePercent = () => {
        const val = parseFloat(display);
        if (!isNaN(val)) setDisplay(formatResult(val / 100));
    };

    // Memory
    const handleMC = () => setMemory(0);
    const handleMR = () => { setDisplay(formatResult(memory)); setLastResult(memory); };
    const handleMPlus = () => setMemory(memory + parseFloat(display || '0'));
    const handleMMinus = () => setMemory(memory - parseFloat(display || '0'));

    function formatResult(val) {
        if (typeof val !== 'number' || isNaN(val)) return 'Error';
        if (!isFinite(val)) return '∞';
        if (Math.abs(val) > 1e15 || (Math.abs(val) < 1e-10 && val !== 0)) {
            return val.toExponential(8);
        }
        const str = parseFloat(val.toPrecision(12)).toString();
        return str.length > 14 ? parseFloat(val.toPrecision(10)).toString() : str;
    }

    if (!isOpen) {
        return (
            <button
                className="calc-fab"
                onClick={() => setIsOpen(true)}
                title="Calculadora Científica"
                id="calc-fab"
            >
                <span className="calc-fab-icon">🧮</span>
            </button>
        );
    }

    return (
        <div className="calc-panel" id="scientific-calculator">
            {/* Header */}
            <div className="calc-header">
                <div className="calc-header-left">
                    <span className="calc-title">🧮 Calculadora</span>
                    <button
                        className="calc-mode-btn"
                        onClick={() => setIsScientific(!isScientific)}
                        title={isScientific ? 'Modo básico' : 'Modo científico'}
                    >
                        {isScientific ? 'Científica' : 'Básica'}
                    </button>
                </div>
                <div className="calc-header-right">
                    <button
                        className="calc-icon-btn"
                        onClick={() => setShowHistory(!showHistory)}
                        title="Historial"
                    >📜</button>
                    <button
                        className="calc-icon-btn calc-close-btn"
                        onClick={() => setIsOpen(false)}
                        title="Cerrar"
                    >✕</button>
                </div>
            </div>

            {/* History panel */}
            {showHistory && (
                <div className="calc-history">
                    {history.length === 0 ? (
                        <div className="calc-history-empty">Sin historial</div>
                    ) : history.map((h, i) => (
                        <div key={i} className="calc-history-item" onClick={() => { setDisplay(h.result); setShowHistory(false); }}>
                            <div className="calc-history-expr">{h.expr}</div>
                            <div className="calc-history-result">= {h.result}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Display */}
            <div className="calc-display">
                <div className="calc-expression">{expression || '\u00A0'}</div>
                <div className="calc-result">{display}</div>
                <div className="calc-indicators">
                    {memory !== 0 && <span className="calc-indicator">M</span>}
                    <span className="calc-indicator">{isDeg ? 'DEG' : 'RAD'}</span>
                </div>
            </div>

            {/* Buttons */}
            <div className="calc-buttons">
                {/* Memory row */}
                <div className="calc-row calc-row-memory">
                    <button className="calc-btn calc-btn-mem" onClick={handleMC}>MC</button>
                    <button className="calc-btn calc-btn-mem" onClick={handleMR}>MR</button>
                    <button className="calc-btn calc-btn-mem" onClick={handleMPlus}>M+</button>
                    <button className="calc-btn calc-btn-mem" onClick={handleMMinus}>M-</button>
                </div>

                {isScientific && (
                    <>
                        {/* Scientific row 1 */}
                        <div className="calc-row">
                            <button className="calc-btn calc-btn-sci" onClick={() => setIsDeg(!isDeg)}>
                                {isDeg ? 'DEG' : 'RAD'}
                            </button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('sin')}>sin</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('cos')}>cos</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('tan')}>tan</button>
                        </div>
                        {/* Scientific row 2 */}
                        <div className="calc-row">
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('asin')}>sin⁻¹</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('acos')}>cos⁻¹</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('atan')}>tan⁻¹</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('fact')}>n!</button>
                        </div>
                        {/* Scientific row 3 */}
                        <div className="calc-row">
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('x2')}>x²</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('x3')}>x³</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleOperator('^')}>xⁿ</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('sqrt')}>√</button>
                        </div>
                        {/* Scientific row 4 */}
                        <div className="calc-row">
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('cbrt')}>∛</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('log')}>log</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('ln')}>ln</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('exp')}>eˣ</button>
                        </div>
                        {/* Scientific row 5 */}
                        <div className="calc-row">
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('10x')}>10ˣ</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('inv')}>1/x</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleScientific('abs')}>|x|</button>
                            <button className="calc-btn calc-btn-sci" onClick={() => handleConstant('pi')}>π</button>
                        </div>
                    </>
                )}

                {/* Standard rows */}
                <div className="calc-row">
                    <button className="calc-btn calc-btn-func" onClick={handleClear}>AC</button>
                    <button className="calc-btn calc-btn-func" onClick={handleCE}>CE</button>
                    <button className="calc-btn calc-btn-func" onClick={handleBackspace}>⌫</button>
                    <button className="calc-btn calc-btn-op" onClick={() => handleOperator('÷')}>÷</button>
                </div>
                <div className="calc-row">
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('7')}>7</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('8')}>8</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('9')}>9</button>
                    <button className="calc-btn calc-btn-op" onClick={() => handleOperator('×')}>×</button>
                </div>
                <div className="calc-row">
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('4')}>4</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('5')}>5</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('6')}>6</button>
                    <button className="calc-btn calc-btn-op" onClick={() => handleOperator('-')}>−</button>
                </div>
                <div className="calc-row">
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('1')}>1</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('2')}>2</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('3')}>3</button>
                    <button className="calc-btn calc-btn-op" onClick={() => handleOperator('+')}>+</button>
                </div>
                <div className="calc-row">
                    <button className="calc-btn calc-btn-num" onClick={handleToggleSign}>±</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('0')}>0</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleNumber('.')}>.</button>
                    <button className="calc-btn calc-btn-equals" onClick={handleEquals}>=</button>
                </div>
                <div className="calc-row">
                    <button className="calc-btn calc-btn-num" onClick={() => handleParenthesis('(')}>(</button>
                    <button className="calc-btn calc-btn-num" onClick={() => handleParenthesis(')')}>)</button>
                    <button className="calc-btn calc-btn-num" onClick={handlePercent}>%</button>
                    <button className="calc-btn calc-btn-sci" onClick={() => handleConstant('e')}>e</button>
                </div>
            </div>
        </div>
    );
}
