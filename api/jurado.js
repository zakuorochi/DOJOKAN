// api/jurado.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método HTTP no permitido. Usa POST.' });
    }

    const { matrizPerfecta, datosAlumno, disciplina } = req.body;
    
    // Recuerda cambiar el nombre de tu variable en Vercel a RUNWARE_API_KEY
    const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;

    if (!RUNWARE_API_KEY) {
        return res.status(500).json({ error: 'API Key de Runware no configurada en el servidor.' });
    }

    const promptJurado = `
    Actúa como un Árbitro Internacional experto en ${disciplina.toUpperCase()}.
    MATRIZ IDEAL: ${JSON.stringify(matrizPerfecta)}
    DATOS DEL ALUMNO: ${JSON.stringify(datosAlumno)}
    Compara ambos datos y devuelve la evaluación estricta.
    `;

    try {
        const respuestaRunware = await fetch('https://api.runware.ai/v1', {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RUNWARE_API_KEY}`
            },
            // Runware exige que el payload sea un Array de tareas
            body: JSON.stringify([
                {
                    taskType: "textInference",
                    taskUUID: crypto.randomUUID(), // Genera el UUID v4 obligatorio
                    model: "google:gemini@3.1-flash-lite",
                    outputFormat: "JSON",
                    // Garantizamos que el modelo escupa exactamente la estructura que tu front-end espera
                    jsonSchema: {
                        type: "object",
                        properties: {
                            puntaje_final: { 
                                type: "number", 
                                description: "Puntaje del 0.0 al 10.0" 
                            },
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

        // Control de errores nativos de Runware (ej. cuota excedida, token inválido)
        if (resultado.errors) {
            console.error("Error devuelto por Runware:", resultado.errors);
            return res.status(500).json({ error: 'Fallo en el motor de IA de Runware' });
        }

        // Runware devuelve el texto generado dentro del array "data"
        const textoRespuesta = resultado.data[0].text;
        
        // Lo parseamos y lo enviamos directo al Frontend
        return res.status(200).json(JSON.parse(textoRespuesta));

    } catch (error) {
        console.error("Error fatal en el servidor:", error);
        return res.status(500).json({ error: 'Fallo en la comunicación con el jurado IA' });
    }
}
