// api/jurado.js

export default async function handler(req, res) {
    // Permitir CORS básico por seguridad
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
        
        // Volvemos a usar la variable de entorno de Google
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            console.error("Falta la variable de entorno GEMINI_API_KEY");
            return res.status(500).json({ error: 'Configuración de servidor incompleta (API Key ausente).' });
        }

        if (!matrizPerfecta || !datosAlumno) {
            return res.status(400).json({ error: 'Faltan datos requeridos (matrizPerfecta o datosAlumno).' });
        }

        const promptJurado = `
        Actúa como un Árbitro Internacional experto en ${disciplina || 'taekwondo'}.
        MATRIZ IDEAL: ${JSON.stringify(matrizPerfecta)}
        DATOS DEL ALUMNO: ${JSON.stringify(datosAlumno)}
        Compara ambos datos y devuelve la evaluación estricta.
        `;

        // Endpoint oficial de Google Gemini (usamos 1.5-flash por su alta velocidad de respuesta)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

        const respuestaGemini = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: promptJurado }]
                }],
                // Obligamos a Gemini a devolver un JSON con esta estructura exacta
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            puntaje_final: { type: "NUMBER" },
                            observaciones: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        paso: { type: "INTEGER" },
                                        detalle: { type: "STRING" }
                                    },
                                    required: ["paso", "detalle"]
                                }
                            }
                        },
                        required: ["puntaje_final", "observaciones"]
                    }
                }
            })
        });

        const resultado = await respuestaGemini.json();

        // Control de errores nativos de la API de Google
        if (resultado.error) {
            console.error("Error devuelto por Gemini:", JSON.stringify(resultado.error));
            return res.status(500).json({ error: 'Fallo en el motor de IA de Google', detalles: resultado.error.message });
        }

        // Validación de que la respuesta tenga el formato esperado
        if (!resultado.candidates || !resultado.candidates[0] || !resultado.candidates[0].content) {
            console.error("Respuesta inesperada de Gemini:", JSON.stringify(resultado));
            return res.status(500).json({ error: 'Respuesta inválida del proveedor de IA' });
        }

        // Extraer el texto generado, parsearlo a JSON y enviarlo al frontend
        const textoRespuesta = resultado.candidates[0].content.parts[0].text;
        const jsonLimpio = JSON.parse(textoRespuesta);
        
        return res.status(200).json(jsonLimpio);

    } catch (error) {
        console.error("Excepción crítica en /api/jurado:", error.message, error.stack);
        return res.status(500).json({ error: 'Fallo interno en el servidor', detalle: error.message });
    }
}
