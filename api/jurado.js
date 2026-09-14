// api/jurado.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { matrizPerfecta, datosAlumno, disciplina } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const promptJurado = `
    Actúa como un Árbitro Internacional experto en ${disciplina.toUpperCase()}.
    MATRIZ IDEAL: ${JSON.stringify(matrizPerfecta)}
    DATOS DEL ALUMNO: ${JSON.stringify(datosAlumno)}
    Compara ambos y devuelve ÚNICAMENTE un JSON estricto con:
    { "puntaje_final": 0.0, "observaciones": [{ "paso": numero, "detalle": "error y corrección" }] }
    `;

    try {
        const respuestaGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptJurado }] }],
                generationConfig: { response_mime_type: "application/json" } 
            })
        });

        const resultado = await respuestaGemini.json();
        const textoRespuesta = resultado.candidates[0].content.parts[0].text;
        
        return res.status(200).json(JSON.parse(textoRespuesta));
    } catch (error) {
        console.error("Error en IA:", error);
        return res.status(500).json({ error: 'Fallo al procesar con IA' });
    }
}
