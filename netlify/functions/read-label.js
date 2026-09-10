exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, reason: 'method_not_allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'no_configurada' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, reason: 'body_invalido' }) };
  }

  const { imageBase64, mimeType } = payload;
  if (!imageBase64) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, reason: 'sin_imagen' }) };
  }

  const prompt =
    'Analiza esta foto de una etiqueta de una refaccion automotriz. Extrae estos datos si estan visibles: ' +
    'sku (el codigo de la pieza tal como esta impreso como texto en la etiqueta, NO el numero de un codigo de barras), ' +
    'descripcion, marca, modelo, anio, referencia. ' +
    'Responde SOLAMENTE con un objeto JSON valido con exactamente esas claves (usa cadena vacia "" si un dato no aparece), sin texto adicional ni backticks.';

  try {
    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
              ]
            }
          ],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (resp.status === 429) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'limite_alcanzado' }) };
    }
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'error_api', detail: errText.slice(0, 200) }) };
    }

    const data = await resp.json();
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
        ? data.candidates[0].content.parts[0].text
        : '';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'respuesta_no_valida' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, data: parsed }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'error_red' }) };
  }
};
