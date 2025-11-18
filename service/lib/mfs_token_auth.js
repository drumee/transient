// File: server-team/lib/mfs_token_auth.js
// Purpose: Middleware helper for validating MFS export tokens from headers
// This authenticates requests using x-param-mfs-token header

const { toArray } = require('@drumee/server-essentials');

/**
 * Validate MFS token and return pseudo entity UID
 * 
 * @param {object} context
 * @returns {Promise<object>} - { valid: boolean, pseudo_entity_uid: string|null, error: string|null }
 */
async function validateMfsToken(context) {
  try {
    const token = context.input.get('mfs-token');
    
    if (!token) {
      return {
        valid: false,
        pseudo_entity_uid: null,
        error: 'missing_token'
      };
    }

    context.debug(`[MFS_TOKEN_AUTH] Validating token: ${token.substring(0, 8)}...`);

    let result = await context.yp.await_proc('mfs_token_validate', token);
    result = toArray(result)[0];

    if (!result || result.failed === 1) {
      context.warn(`[MFS_TOKEN_AUTH] Token validation failed: ${result ? result.reason : 'unknown'}`);
      return {
        valid: false,
        pseudo_entity_uid: null,
        error: result ? result.reason : 'invalid_token'
      };
    }

    context.debug(`[MFS_TOKEN_AUTH] Token valid. Pseudo entity: ${result.pseudo_entity_uid}`);

    return {
      valid: true,
      pseudo_entity_uid: result.pseudo_entity_uid,
      hub_id: result.hub_id,
      node_id: result.node_id,
      hub_db_name: result.hub_db_name,
      error: null
    };

  } catch (error) {
    context.warn(`[MFS_TOKEN_AUTH] Exception during token validation:`, error.message);
    return {
      valid: false,
      pseudo_entity_uid: null,
      error: 'validation_error'
    };
  }
}

/**
 * Check if user (or pseudo entity) has permission to access resource
 * 
 * @param {object} context
 * @param {string} uid - User ID or pseudo entity UID
 * @param {string} resourceId - Resource ID (node ID)
 * @param {number} requiredPermission - Required permission level (1=read, 2=write, etc.)
 * @returns {Promise<boolean>} - true if has permission
 */
async function checkPermission(context, uid, resourceId, requiredPermission = 1) {
  try {
    // Use user_permission function from hub database
    const permission = await context.db.await_func('user_permission', uid, resourceId);
    
    context.debug(`[MFS_TOKEN_AUTH] Permission check: uid=${uid}, resource=${resourceId}, permission=${permission}, required=${requiredPermission}`);
    
    // Check if user has at least the required permission level
    // Permission is a bitmask: 1=read, 2=write, 4=delete, 8=admin, etc.
    return (permission & requiredPermission) !== 0;

  } catch (error) {
    context.warn(`[MFS_TOKEN_AUTH] Exception during permission check:`, error.message);
    return false;
  }
}

module.exports = {
  validateMfsToken,
  checkPermission
};