export const ROLES = {
CUSTOMER: 'customer',
AGENT: 'agent',
ADMIN_HEAD: 'admin_head',
ADMIN_CUSTOMER_SERVICE: 'admin_customer_service',
ADMIN_AGENT_SERVICE: 'admin_agent_service'
};


export const ADMIN_ROLES = new Set([
ROLES.ADMIN_HEAD,
ROLES.ADMIN_CUSTOMER_SERVICE,
ROLES.ADMIN_AGENT_SERVICE
]);