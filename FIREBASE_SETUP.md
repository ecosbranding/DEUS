# Firebase: alta con PIN en DEUS

El cliente usa el proyecto `geometria-760b8` y la configuración web que compartiste. El `apiKey` de Firebase identifica el proyecto, no es la contraseña de la base de datos. El PIN nunca se guarda en el navegador ni en texto plano.

El acceso `@PIN*` se valida en dos Cloud Functions. Firebase Authentication emite la sesión; Firestore guarda el hash con sal y una clave secreta del servidor. Las reglas de Firestore bloquean el acceso directo a esas colecciones.

## Configuración inicial

1. Abre [Firebase Console](https://console.firebase.google.com/) y selecciona **geometria-760b8**.
2. En **Authentication**, activa Firebase Authentication. El servidor usa autenticación personalizada de Firebase; no hace falta pedir correo ni contraseña.
3. En **Firestore Database**, crea la base de datos predeterminada en modo producción. Elige `us-central1` para que coincida con las Cloud Functions. Al desplegar, `firestore.rules` mantiene la colección de PIN privada.
4. Cambia el proyecto al plan **Blaze** para desplegar Cloud Functions. Firebase exige facturación para las funciones. Añade un presupuesto y alertas en Google Cloud Billing para vigilar el gasto.
5. Abre [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin/create), registra un sitio con el proveedor basado en puntuación **reCAPTCHA v3** y añade estos dominios: `localhost`, `geometria-760b8.web.app`, `geometria-760b8.firebaseapp.com` y tu dominio propio si tienes uno. Copia la **site key** y la **secret key**.
6. En Firebase Console → **App Check** → tu app web → **Register** → **reCAPTCHA v3**, pega la secret key de reCAPTCHA. La función PIN ya exige App Check. La site key pública se conecta al cliente en el siguiente paso.
7. Copia `.env.example` a `.env.local` y pega la site key pública de reCAPTCHA:

   ```env
   VITE_RECAPTCHA_V3_SITE_KEY=tu_clave_publica_de_recaptcha
   ```

   Reinicia `npm run dev` después de crear o cambiar `.env.local`. Para Firebase Hosting, vuelve a ejecutar `npm run build` cada vez que cambies la clave.

## Desplegar el servidor PIN

Instala la herramienta oficial de Firebase CLI e inicia sesión:

```bash
npm install -g firebase-tools
firebase login
firebase use geometria-760b8
```

Genera una clave secreta nueva (no reutilices contraseñas) y configúrala como secreto de Cloud Functions. No la pongas en `.env.local`, en React ni en Git:

```bash
openssl rand -base64 48
firebase functions:secrets:set PIN_PEPPER
```

Cuando Firebase pregunte el valor, pega la cadena generada. Después instala las dependencias del servidor y despliega las reglas y las funciones:

```bash
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,functions
```

La primera publicación puede pedir confirmar APIs de Google Cloud. Espera a que termine y vuelve a cargar el sitio. En Authentication → **Settings** → **Authorized domains**, añade `localhost` para desarrollo y el dominio real de producción.

Para publicar también la web en Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Registro y límites del PIN

- Escribe únicamente entre 8 y 12 números. El formulario pone `@` delante y `*` detrás; el servidor verifica el formato completo `@12345678*`.
- Usa un PIN largo, único y que no reutilices. Un límite de 12 intentos por IP cada 15 minutos y Firebase App Check reducen el abuso.
- Este método no recoge correo ni teléfono. Si alguien olvida su PIN, no hay forma de recuperar esa cuenta; guarda el PIN en un gestor seguro.
- El `apiKey`, el ID de aplicación y el dominio del proyecto están pensados para el SDK del navegador. No pongas nunca el secreto `PIN_PEPPER` en el frontend.
- La cuenta Firebase conserva su sesión entre visitas y dispositivos cuando se inicia sesión; la tabla actual de récords del juego sigue guardándose localmente en cada navegador.

## Si algo falla

- `Falta configurar la clave de reCAPTCHA`: revisa `.env.local`, reinicia Vite y comprueba que la aplicación esté registrada en App Check.
- `functions/not-found`: las Cloud Functions aún no se desplegaron en `us-central1`.
- `functions/permission-denied` o error de App Check: revisa el dominio de reCAPTCHA, el sitio registrado en App Check y los dominios autorizados.
- Error al crear `PIN_PEPPER`: vuelve a ejecutar `firebase functions:secrets:set PIN_PEPPER` y despliega otra vez las funciones.
- Si aparece un error de `iam.serviceAccounts.signBlob` al emitir una sesión, en Google Cloud Console → IAM concede **Service Account Token Creator** a la cuenta de servicio que ejecuta la Cloud Function, sobre sí misma, y vuelve a probar.
- Firestore `PERMISSION_DENIED` desde el navegador es el comportamiento esperado para las colecciones privadas; las funciones acceden con el Admin SDK.