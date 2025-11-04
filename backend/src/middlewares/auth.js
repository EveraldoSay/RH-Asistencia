const { createRemoteJWKSet, jwtVerify } = require('jose');

const ISSUER = process.env.KEYCLOAK_ISSUER
  || (
    process.env.KEYCLOAK_URL && process.env.KEYCLOAK_REALM
      ? `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`
      : null
  );

if (!ISSUER) {
  throw new Error('Faltan KEYCLOAK_ISSUER o KEYCLOAK_URL/KEYCLOAK_REALM');
}

const AUDIENCE = process.env.KEYCLOAK_AUDIENCE;
const CLIENT_ID_FOR_ROLES = process.env.KEYCLOAK_CLIENT_ROLES || AUDIENCE;

const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`));

function getToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function collectRolesFromToken(payload) {
  const realmRoles = payload?.realm_access?.roles || [];
  const clientId = CLIENT_ID_FOR_ROLES || '';
  const clientRoles = clientId ? (payload?.resource_access?.[clientId]?.roles || []) : [];
  return Array.from(new Set([
    ...realmRoles.map(r => r.toLowerCase()),
    ...clientRoles.map(r => r.toLowerCase()),
  ]));
}

async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ success: false, error: 'Token no válido o ausente' });

    const verifyOptions = { issuer: ISSUER };
    if (AUDIENCE) verifyOptions.audience = AUDIENCE;

    const { payload } = await jwtVerify(token, JWKS, verifyOptions);
    req.user = {
      sub: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      roles: collectRolesFromToken(payload),
      raw: payload,
    };
    next();
  } catch (e) {
    console.error('JWT verification error:', e.message);
    res.status(401).json({ success: false, error: 'Token no válido o expirado' });
  }
}

const requireAllRoles = (...needed) => (req, res, next) => {
  const roles = req.user?.roles || [];
  const ok = needed.map(r => r.toLowerCase()).every(r => roles.includes(r));
  if (!ok) return res.status(403).json({ success: false, error: `Requiere roles: ${needed.join(', ')}` });
  next();
};

const requireAnyRole = (...accepted) => (req, res, next) => {
  const roles = req.user?.roles || [];
  const ok = roles.some(r => accepted.map(x => x.toLowerCase()).includes(r));
  if (!ok) return res.status(403).json({ success: false, error: `Requiere alguno de: ${accepted.join(', ')}` });
  next();
};

const requireAdmin = requireAllRoles('admin');
const requireRRHH = requireAllRoles('rrhh');
const requireJefe = requireAllRoles('jefe');
const requireRRHHorJefe = requireAnyRole('rrhh', 'jefe');

module.exports = {
  requireAuth,
  requireAllRoles,
  requireAnyRole,
  requireAdmin,
  requireRRHH,
  requireJefe,
  requireRRHHorJefe,
};
