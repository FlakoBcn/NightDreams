// testScript.js
// Prueba simple para verificar la llamada a Google Apps Script

export async function testGoogleScript() {
  const url = 'https://script.google.com/macros/s/AKfycbwJSZWWiidAOgs3HxCOiSQPaNyqdygjPUGF5-REGzx3pV-ylYw9Pi4BAGAFDGHEtqZ4GA/exec'; // Cambia por tu URL si es necesario
  const testData = {
    accion: 'prueba',
    mensaje: 'Hola desde NightDreams!'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(testData)
    });
    const result = await res.text();
    console.log('Respuesta Google Script:', result);
    alert('Respuesta Google Script: ' + result);
  } catch (err) {
    console.error('Error al llamar a Google Script:', err);
    alert('Error al llamar a Google Script: ' + err.message);
  }
  // Prueba con y sin Content-Type
  let resultNoHeader = '', resultWithHeader = '';
  try {
    // Sin header
    const res1 = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(testData)
    });
    resultNoHeader = await res1.text();
  } catch (err) {
    resultNoHeader = 'Error: ' + err.message;
  }

  try {
    // Con header
    const res2 = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(testData),
      headers: { 'Content-Type': 'application/json' }
    });
    resultWithHeader = await res2.text();
  } catch (err) {
    resultWithHeader = 'Error: ' + err.message;
  }

  alert(
    'Sin Content-Type: ' + resultNoHeader + '\n' +
    'Con Content-Type: ' + resultWithHeader
  );

  console.log('Sin Content-Type:', resultNoHeader);
  console.log('Con Content-Type:', resultWithHeader);
}
