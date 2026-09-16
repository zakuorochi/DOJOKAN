// api/jurado.js
import crypto from 'node:crypto';

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
        
        const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

        if (!RUNWARE_API_KEY) {
            console.error("Falta la variable de entorno RUNWARE_API_KEY");
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

        const respuestaRunware = await fetch('https://api.runware.ai/v1', {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RUNWARE_API_KEY}`
            },
            body: JSON.stringify([
                {
                    taskType: "textInference",
                    taskUUID: crypto.randomUUID(),
                    model: "google:gemini@3.1-flash-lite",
                    outputFormat: "JSON",
                    jsonSchema: {
                        type: "object",
                        properties: {
                            puntaje_final: { type: "number" },
                            observaciones: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        paso: { type: "integer" },
                                        detalle: { type: "string" }
                                    },
                                    required: ["paso", "detalle"]
                                }
                            }
                        },
                        required: ["puntaje_final", "observaciones"]
                    },
                    messages: [
                        {
                            role: "user",
                            content: promptJurado
                        }
                    ]
                }
            ])
        });

        const resultado = await respuestaRunware.json();

        if (resultado.errors) {
            console.error("Error devuelto por Runware:", JSON.stringify(resultado.errors));
            return res.status(500).json({ error: 'Fallo en el motor de IA de Runware', detalles: resultado.errors });
        }

        if (!resultado.data || !resultado.data[0] || !resultado.data[0].text) {
            console.error("Respuesta inesperada de Runware:", JSON.stringify(resultado));
            return res.status(500).json({ error: 'Respuesta inválida del proveedor de IA' });
        }

        const textoRespuesta = resultado.data[0].text;
        const jsonLimpio = JSON.parse(textoRespuesta);
        
        return res.status(200).json(jsonLimpio);

    } catch (error) {
        console.error("Excepción crítica en /api/jurado:", error.message, error.stack);
        return res.status(500).json({ error: 'Fallo interno en el servidor', detalle: error.message });
    }
}
