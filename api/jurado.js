// api/jurado.js

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método HTTP no permitido. Usa POST.' });
    }

    try {
        const { matrizPerfecta, datosAlumno, disciplina } = req.body || {};
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'API Key ausente en la configuración del servidor.' });
        }

        if (!matrizPerfecta || !datosAlumno) {
            return res.status(400).json({ error: 'Faltan datos requeridos.' });
        }

        // FILTRO DE "NO HICE NADA" (Evita llamadas innecesarias a la IA)
        if (!datosAlumno.pasos_registrados || datosAlumno.pasos_registrados.length === 0) {
            return res.status(200).json({
                puntaje_final: 0.0,
                resumen_general: "(NO CALIFICABLE). No se detectaron movimientos válidos del usuario en la cámara. Por favor, asegúrate de realizar la forma completa frente al tótem.",
                errores_y_deducciones: [],
                plan_mejora: []
            });
        }

        const promptJurado = `
        Actúa como un Árbitro Internacional experto en ${disciplina || 'taekwondo'} y Especialista en Biomecánica.
        MATRIZ IDEAL: ${JSON.stringify(matrizPerfecta)}
        DATOS DEL ALUMNO: ${JSON.stringify(datosAlumno)}
        
        Sé implacable pero constructivo. Analiza las diferencias geométricas y de tiempos. 
        Resta puntos por cada postura incorrecta, falta de fuerza o error de ritmo. Genera el informe técnico:
        1. Puntaje final estricto sobre 10.0.
        2. Resumen general de la evaluación.
        3. Errores específicos por paso y la razón de la deducción de puntos.
        4. Plan de mejora con ejercicios.
        `;

        // URL corregida al modelo oficial de Google
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const respuestaGemini = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: promptJurado }]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            puntaje_final: { type: "NUMBER" },
                            resumen_general: { type: "STRING" },
                            errores_y_deducciones: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        paso: { type: "INTEGER" },
                                        falla_tecnica: { type: "STRING" },
                                        razon_deduccion: { type: "STRING" }
                                    },
                                    required: ["paso", "falla_tecnica", "razon_deduccion"]
                                }
                            },
                            plan_mejora: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        objetivo_tecnico: { type: "STRING" },
                                        ejercicio_recomendado: { type: "STRING" }
                                    },
                                    required: ["objetivo_tecnico", "ejercicio_recomendado"]
                                }
                            }
                        },
                        required: ["puntaje_final", "resumen_general", "errores_y_deducciones", "plan_mejora"]
                    }
                }
            })
        });

        const resultado = await respuestaGemini.json();

        if (resultado.error) {
            return res.status(500).json({ error: 'Fallo en la IA', detalles: resultado.error.message });
        }

        const textoRespuesta = resultado.candidates[0].content.parts[0].text;
        const jsonLimpio = JSON.parse(textoRespuesta);
        
        return res.status(200).json(jsonLimpio);

    } catch (error) {
        return res.status(500).json({ error: 'Fallo interno', detalle: error.message });
    }
}
