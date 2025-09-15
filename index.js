const express = require('express');
require('dotenv').config();
const nodemailer = require('nodemailer');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());

// Swagger base config + esquemas estándar
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Unify Mail API',
      version: '1.0.0',
      description: 'API para enviar correos electrónicos',
    },
    components: {
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            code: { type: 'string', example: 'EMAIL_SENT' },
            message: { type: 'string', example: 'Correo enviado correctamente' },
            data: {
              type: 'object',
              example: {
                messageId: 'abc123',
                to: 'destino@correo.com',
                subject: 'Bienvenido',
                validationUrl: 'https://validacion.centrobiblico.com/validar/xyz'
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: false },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: "El campo 'to' es obligatorio" },
            details: { type: 'string', example: 'Validation error: missing to' },
            errors: { type: 'array', items: { type: 'string' }, example: [] }
          }
        }
      }
    }
  },
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Utilidades
function generateToken(len = 10) {
  return Math.random().toString(36).slice(2, 2 + len);
}
const VALIDATION_BASE_URL = process.env.VALIDATION_BASE_URL || 'https://validacion.centrobiblico.com/validar';

// Helpers de respuesta estandarizados
function sendSuccess(res, { code = 'SUCCESS', message = 'OK', data = null, status = 200 }) {
  return res.status(status).json({ ok: true, code, message, data });
}

function sendError(res, { code = 'INTERNAL_ERROR', message = 'Ocurrió un error', details, errors, status = 500 }) {
  return res.status(status).json({ ok: false, code, message, details, errors });
}

function mapEmailError(error) {
  switch (error && error.code) {
    case 'EAUTH':
      return { code: 'SMTP_AUTH_FAILED', status: 401, message: 'Autenticación SMTP fallida' };
    case 'ENOTFOUND':
      return { code: 'SMTP_HOST_NOT_FOUND', status: 502, message: 'Servidor SMTP no encontrado' };
    case 'ETIMEDOUT':
      return { code: 'SMTP_TIMEOUT', status: 504, message: 'Tiempo de espera agotado con el servidor SMTP' };
    default:
      return { code: 'EMAIL_SEND_FAILED', status: 500, message: 'No se pudo enviar el correo' };
  }
}

/**
 * @swagger
 * /send:
 *   post:
 *     summary: Enviar correo de bienvenida con link de validación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, validationUrl]
 *             properties:
 *               to:
 *                 type: string
 *                 example: "destinatario@correo.com"
 *               validationUrl:
 *                 type: string
 *                 example: "https://validacion.centrobiblico.com/validar/abcd1234"
 *     responses:
 *       200:
 *         description: Correo enviado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Error de validación de entrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Error de autenticación con SMTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Host SMTP no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       504:
 *         description: Timeout con SMTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error al enviar el correo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/send', async (req, res) => {
  const to = req.body.to;
  const providedValidationUrl = req.body.validationUrl || req.body.validationurl;
  const subject = 'Bienvenido al Centro Bíblico Alianza Comas';

  if (!to) {
    return sendError(res, { code: 'VALIDATION_ERROR', message: "El campo 'to' es obligatorio", status: 400 });
  }
  if (!providedValidationUrl) {
    return sendError(res, { code: 'VALIDATION_ERROR', message: "El campo 'validationUrl' es obligatorio", status: 400 });
  }

  // Usar URL de validación provista (fallback a generación si fuese necesario)
  const finalValidationUrl = providedValidationUrl || `${VALIDATION_BASE_URL}/${generateToken(8)}`;

  const welcomeHtml = `
    <div style="background-color:#1a2942;padding:30px;border-radius:10px;font-family:sans-serif;color:#fff;max-width:500px;margin:auto;">
      <h2 style="color:#fff;margin-top:0;">Bienvenido al <span style='color:#bfc9d9;'>Centro Bíblico Alianza Comas</span></h2>
      <p style="font-size:16px;color:#fff;">¡Gracias por registrarte! Estamos felices de tenerte con nosotros.</p>
      <div style="background:#fff;padding:20px;border-radius:8px;margin:20px 0;">
        <p style="color:#1a2942;font-size:15px;margin:0 0 10px 0;">Para validar tu cuenta, haz clic en el siguiente enlace:</p>
  <a href="${finalValidationUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#1a2942;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none;font-weight:bold;">Validar cuenta</a>
        <br/>
  <a href="https://cebac-phi.vercel.app/login" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#1a2942;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none;font-weight:bold;margin-top:10px;">Acceso al portal</a>
      </div>
      <p style="font-size:13px;color:#bfc9d9;">Si no solicitaste este registro, puedes ignorar este correo.</p>
    </div>
  `;

  try {
    // Configuración de transporte (usar credenciales reales en producción)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'notificacionescebac@gmail.com',
        pass: process.env.GMAIL_PASS || 'vlpy pkxn lotg cuok',
      },
    });

    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER || 'notificacionescebac@gmail.com',
      to,
      subject,
      html: welcomeHtml,
    });

    return sendSuccess(res, {
      code: 'EMAIL_SENT',
      message: 'Correo enviado correctamente',
      data: { messageId: info && info.messageId, to, subject, validationUrl: finalValidationUrl },
      status: 200,
    });
  } catch (error) {
    const mapped = mapEmailError(error);
    return sendError(res, {
      code: mapped.code,
      message: mapped.message,
      details: process.env.NODE_ENV === 'production' ? undefined : (error && error.message),
      status: mapped.status,
    });
  }
});

// Middleware global de errores (fallback)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const details = process.env.NODE_ENV === 'production' ? undefined : (err && err.message);
  return sendError(res, { code: 'UNHANDLED_ERROR', message: 'Error no manejado', details, status: 500 });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  console.log(`Documentación Swagger en http://localhost:${PORT}/api-docs`);
});
