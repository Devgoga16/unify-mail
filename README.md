# Unify Mail

API en Node.js con Express para enviar correos electrónicos y documentación Swagger.

## Instalación

```bash
npm install
```

## Uso

1. Configura las credenciales SMTP en `index.js`.
2. Inicia el servidor:

```bash
npm start
```

3. Accede a la documentación Swagger en [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

## Endpoint

### POST /send

Envía un correo electrónico.

**Body JSON:**
```
{
  "to": "destinatario@correo.com",
  "subject": "Asunto del correo",
  "text": "Mensaje del correo"
}
```

**Respuesta:**
- 200: Correo enviado correctamente
- 500: Error al enviar el correo
