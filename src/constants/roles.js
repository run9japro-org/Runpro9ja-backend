// constants/roles.js
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_HEAD: 'admin_head',
  ADMIN_AGENT_SERVICE: 'admin_agent_service',
  ADMIN_CUSTOMER_SERVICE: 'admin_customer_service',
  REPRESENTATIVE : "representative",
  AGENT: 'agent',
  CUSTOMER: 'customer'
};



export const ADMIN_ROLES = new Set([
ROLES.SUPER_ADMIN,
ROLES.ADMIN_HEAD,
ROLES.ADMIN_CUSTOMER_SERVICE,
ROLES.ADMIN_AGENT_SERVICE,
ROLES.REPRESENTATIVE
]);