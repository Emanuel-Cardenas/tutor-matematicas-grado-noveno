// Módulo de IA — OpenRouter API (compatible con OpenAI format)
// Modelo principal: DeepSeek V3 — excelente en matemáticas, JSON y español
// Con fallback automático a modelo gratuito y API directa de Google Gemini

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324';
const OPENROUTER_FREE_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Fallback directo a Google Gemini API (si la key existe)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

/**
 * Llama a la API directa de Google Gemini como último fallback.
 * Convierte el formato OpenAI a formato Gemini.
 */
async function callGeminiDirect(messages, options = {}) {
    if (!GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY disponible para fallback');

    // Convertir messages OpenAI → Gemini format
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const body = {
        contents,
        generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.max_tokens ?? 4096,
        },
    };

    const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini Direct API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenRouter(messages, options = {}) {
    const requestedModel = options.model || OPENROUTER_MODEL;
    const body = {
        model: requestedModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 8192,
    };


    if (options.reasoning !== undefined) {
        body.reasoning = options.reasoning;
    }

    const fetchHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'YedaTech Tutor',
    };

    // Intento 1: modelo solicitado con reintentos
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout
        let res;
        try {
            res = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (fetchErr) {
            clearTimeout(timeout);
            if (fetchErr.name === 'AbortError') {
                console.warn(`[OpenRouter] Timeout en intento ${attempt + 1}/${MAX_RETRIES + 1}`);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
                    continue;
                }
                break;
            }
            throw fetchErr;
        }
        clearTimeout(timeout);

        if (res.ok) {
            const data = await res.json();
            return data.choices?.[0]?.message?.content || '';
        }

        const errorText = await res.text();

        if ((res.status === 429 || res.status === 502 || res.status === 503) && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(`[OpenRouter] ${res.status} (intento ${attempt + 1}/${MAX_RETRIES + 1}), reintentando en ${delay / 1000}s...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }

        // Si agotó reintentos con 429, intentar fallbacks
        if (res.status === 429) break;

        // Para errores no-retriables (401, 403, etc.), ir directo a fallbacks en lugar de lanzar
        console.error(`OpenRouter error ${res.status}:`, errorText);
        break;
    }

    // Fallback 1: modelo gratuito de OpenRouter (solo si no es error de auth)
    const lastErrorWasAuth = true; // Si llegamos aquí por break, podría ser auth
    if (requestedModel !== OPENROUTER_FREE_MODEL) {
        console.warn(`[OpenRouter] ⚡ Modelo ${requestedModel} falló. Probando modelo gratuito...`);
        const freeBody = { ...body, model: OPENROUTER_FREE_MODEL };
        try {
            const res = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify(freeBody),
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`[OpenRouter] ✅ Modelo gratuito respondió exitosamente`);
                return data.choices?.[0]?.message?.content || '';
            }
        } catch (e) {
            console.warn(`[OpenRouter] Modelo gratuito también falló: ${e.message}`);
        }
    }

    // Fallback 2: API directa de Google Gemini
    if (GEMINI_API_KEY) {
        console.warn(`[OpenRouter] ⚡ Todos los modelos OpenRouter rate-limited. Usando Gemini API directa...`);
        try {
            const result = await callGeminiDirect(messages, options);
            console.log(`[Gemini Direct] ✅ Respuesta exitosa vía API directa`);
            return result;
        } catch (e) {
            console.error(`[Gemini Direct] ❌ También falló: ${e.message}`);
        }
    }

    throw new Error(`Todos los proveedores de IA están temporalmente no disponibles (rate limit). Intenta de nuevo en unos minutos.`);
}

export async function callGemini(systemPrompt, userMessage, history = []) {
    // DeepSeek V3 soporta role "system" nativamente
    const messages = [
        { role: 'system', content: systemPrompt },
    ];

    // Agregar historial de conversacion
    for (const msg of history) {
        messages.push({
            role: msg.role === 'student' ? 'user' : 'assistant',
            content: msg.content,
        });
    }

    messages.push({ role: 'user', content: userMessage });

    return callOpenRouter(messages);
}

export async function callGeminiJSON(systemPrompt, userMessage, options = {}) {
    // DeepSeek V3 soporta role "system" y genera JSON de forma confiable
    const messages = [
        {
            role: 'system',
            content: `${systemPrompt}\n\nIMPORTANTE CRÍTICO: Responde ÚNICAMENTE con un objeto JSON válido. SIN markdown, SIN bloques de código como \`\`\`json, SIN texto antes ni después. Tu respuesta debe comenzar exactamente con { y terminar exactamente con }.`
        },
        {
            role: 'user',
            content: userMessage
        },
    ];

    let text = '';
    try {
        text = await callOpenRouter(messages, {
            temperature: options.temperature ?? 0.3,
            max_tokens: options.max_tokens ?? 8192,
            ...options,
        });
    } catch (err) {
        console.error('[callGeminiJSON] Error llamando OpenRouter:', err.message);
        return null;
    }

    if (!text || text.trim().length === 0) {
        console.error('[callGeminiJSON] Respuesta vacía de OpenRouter');
        return null;
    }

    // Limpiar posibles artefactos de formato (markdown, bloques de código, etc)
    let cleaned = text
        .replace(/^```json\s*/im, '')
        .replace(/^```\s*/im, '')
        .replace(/```\s*$/m, '')
        .trim();

    // Intento 1: parseo directo
    try {
        return JSON.parse(cleaned);
    } catch { }

    // Intento 2: extraer el JSON object más grande (ignorar texto antes/después)
    try {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch { }

    // Intento 3: extraer array JSON
    try {
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) return JSON.parse(arrayMatch[0]);
    } catch { }

    // Intento 4: reparar JSON truncado extrayendo objetos completos del array
    try {
        const repaired = repairTruncatedJSON(cleaned);
        if (repaired) {
            console.log(`[callGeminiJSON] JSON reparado: ${repaired.questions?.length || 0} objetos extraídos`);
            return repaired;
        }
    } catch { }

    console.error('[callGeminiJSON] Todos los intentos de parse fallaron. Texto crudo (primeros 800 chars):', cleaned.substring(0, 800));
    return null;
}

/**
 * Intenta reparar un JSON truncado extrayendo los objetos completos de un array.
 * Útil cuando max_tokens trunca la respuesta a mitad de un objeto.
 */
function repairTruncatedJSON(text) {
    // Intento A: para estructura {"questions": [...]} (exam-generator)
    const questionsStart = text.indexOf('"questions"');
    if (questionsStart !== -1) {
        const arrayStart = text.indexOf('[', questionsStart);
        if (arrayStart !== -1) {
            const objects = [];
            let depth = 0;
            let objStart = -1;
            for (let i = arrayStart + 1; i < text.length; i++) {
                if (text[i] === '{' && depth === 0) { objStart = i; depth = 1; }
                else if (text[i] === '{') depth++;
                else if (text[i] === '}') {
                    depth--;
                    if (depth === 0 && objStart !== -1) {
                        try { objects.push(JSON.parse(text.substring(objStart, i + 1))); } catch { }
                        objStart = -1;
                    }
                }
            }
            if (objects.length > 0) {
                console.log(`Repaired truncated JSON: extracted ${objects.length} complete question objects`);
                return { questions: objects };
            }
        }
    }

    // Intento B: para reportes de diagnóstico (JSON truncado con objetos anidados)
    // Busca el JSON raíz y cierra arrays/objetos abiertos para hacer parseable
    try {
        const firstBrace = text.indexOf('{');
        if (firstBrace === -1) return null;
        let jsonStr = text.substring(firstBrace);
        // Contar llaves y corchetes abiertos
        let braces = 0, brackets = 0;
        let lastValidPos = -1;
        let inString = false, escape = false;
        for (let i = 0; i < jsonStr.length; i++) {
            const c = jsonStr[i];
            if (escape) { escape = false; continue; }
            if (c === '\\') { escape = true; continue; }
            if (c === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c === '{') braces++;
            if (c === '}') { braces--; if (braces === 0) lastValidPos = i; }
            if (c === '[') brackets++;
            if (c === ']') brackets--;
        }
        // Si encontramos un cierre completo del objeto raíz, usar hasta ahí
        if (lastValidPos > 0) {
            try {
                return JSON.parse(jsonStr.substring(0, lastValidPos + 1));
            } catch { }
        }
        // Si está truncado, intentar cerrar los delimitadores abiertos
        if (braces > 0 || brackets > 0) {
            // Truncar desde el último cierre válido de propiedad
            const lastComma = jsonStr.lastIndexOf(',');
            const lastColon = jsonStr.lastIndexOf(':');
            const cutPoint = Math.max(lastComma, 0);
            if (cutPoint > 0) {
                let repaired = jsonStr.substring(0, cutPoint);
                // Re-contar delimitadores
                braces = 0; brackets = 0; inString = false; escape = false;
                for (let i = 0; i < repaired.length; i++) {
                    const c = repaired[i];
                    if (escape) { escape = false; continue; }
                    if (c === '\\') { escape = true; continue; }
                    if (c === '"') { inString = !inString; continue; }
                    if (inString) continue;
                    if (c === '{') braces++;
                    if (c === '}') braces--;
                    if (c === '[') brackets++;
                    if (c === ']') brackets--;
                }
                while (brackets > 0) { repaired += ']'; brackets--; }
                while (braces > 0) { repaired += '}'; braces--; }
                try {
                    const result = JSON.parse(repaired);
                    console.log('[callGeminiJSON] JSON truncado reparado exitosamente');
                    return result;
                } catch { }
            }
        }
    } catch { }

    return null;
}

/**
 * Envía una imagen + texto a un modelo con visión vía OpenRouter.
 * DeepSeek V3 no soporta visión, así que usamos el modelo principal
 * para texto puro y mantenemos un fallback a Gemini para imágenes.
 * 
 * @param {string} systemPrompt — instrucciones del sistema
 * @param {string} userMessage — mensaje de texto del usuario
 * @param {string} base64Image — imagen en base64 (sin prefijo data:...)
 * @param {string} mimeType — tipo MIME (ej: image/jpeg, image/png)
 * @returns {string} respuesta del modelo
 */
export async function callGeminiVision(systemPrompt, userMessage, base64Image, mimeType = 'image/jpeg') {
    // Para visión, usamos google/gemini-2.0-flash-001 ya que DeepSeek V3 no soporta imágenes
    const VISION_MODEL = 'google/gemini-2.0-flash-001';
    
    const messages = [
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `${systemPrompt}\n\n---\n\n${userMessage}\n\nIMPORTANTE: Tu respuesta DEBE ser ÚNICAMENTE JSON válido. Sin markdown, sin bloques de código, sin texto antes o después. Solo el objeto JSON puro comenzando con { y terminando con }.`,
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${base64Image}`,
                    },
                },
            ],
        },
    ];

    const body = {
        model: VISION_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 4096,
    };

    const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'YedaTech Tutor',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`OpenRouter Vision error ${res.status}:`, errorText);
        throw new Error(`OpenRouter Vision API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}
