require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { requireAuth, requireRRHHorJefe } = require('./src/middlewares/auth.js');


const biometricRouter = require('./src/routes/biometric.routes.js');
const healthRouter    = require('./src/routes/health.routes.js');
const empleadosRouter = require('./src/routes/empleados.routes.js');
const rolesRoutes     = require('./src/routes/roles.routes.js');
const areasRoutes     = require('./src/routes/areas.routes.js');
const dashboardRouter = require('./src/routes/dashboard.routes.js');
const turnosRoutes    = require('./src/routes/turnos.routes.js');
const asignacionesRoutes = require('./src/routes/asignaciones.routes.js');
const attachActor     = require('./src/middlewares/actor.js');
const auditRouter     = require('./src/routes/audit.routes.js');
const reportesRouter  = require('./src/routes/reportes.routes.js');
const biometricPushRoutes = require('./src/routes/biometric.push.routes.js');


const app = express();

app.use(cors({
  origin: ['http://localhost:8020', 'http://127.0.0.1:8020', 'http://localhost:4200'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas publicas
app.use('/api/health', healthRouter);

// Rutas protegidas
app.use('/api/biometric', requireAuth, requireRRHHorJefe, biometricRouter);
app.use('/api/empleados', requireAuth, requireRRHHorJefe, empleadosRouter);
app.use('/api/roles', requireAuth,requireRRHHorJefe, rolesRoutes);
app.use('/api/areas', requireAuth,requireRRHHorJefe, areasRoutes);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/turnos', requireAuth, requireRRHHorJefe, turnosRoutes);
app.use('/api/asignaciones', requireAuth, requireRRHHorJefe, asignacionesRoutes);
app.use('/api/audit',        requireAuth, attachActor, auditRouter);
app.use('/api/audit', requireAuth, attachActor, auditRouter);
app.use('/api/reportes', requireAuth, requireRRHHorJefe, reportesRouter);
app.use('/api', biometricPushRoutes);


// 404 JSON para /api/*
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  (`Servidor corriendo en http://localhost:${PORT}`);
  ('[KC cfg]', {
    KEYCLOAK_URL: process.env.KEYCLOAK_URL,
    KEYCLOAK_REALM: process.env.KEYCLOAK_REALM,
    KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER,
  });
});
