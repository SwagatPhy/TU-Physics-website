// Whether this build includes the Student/Faculty Portal (login, register,
// portal, faculty dashboard, approvals). One build-time setting:
//
//   PUBLIC_PORTAL_ENABLED=true   `npm run dev:portal`, `npm run build:portal`
//   anything else / unset        `npm run dev`, `npm run build` (the default)
//
// Off by default, so the public site can be deployed before the university's
// IT cell hosts the portal API: no Login/Register buttons, and the portal pages
// (src/portal-pages/) are not built at all (see astro.config.mjs).
export const portalEnabled = import.meta.env.PUBLIC_PORTAL_ENABLED === 'true';
