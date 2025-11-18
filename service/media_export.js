// File: server-team/service/media_export.js
// Purpose: Extended media service with MFS token authentication for export/import
// Extends existing media service to support token-based access

const { Mfs } = require('@drumee/server-core');
const { Attr, toArray } = require('@drumee/server-essentials');
const { validateMfsToken, checkPermission } = require('../lib/mfs_token_auth');

class MediaExport extends Mfs {

  initialize(opt) {
    super.initialize(opt);
    this.debug("[MEDIA_EXPORT] Service initialized");
  }

  /**
   * Authenticate request using MFS token
   * Sets this.tokenAuth with authentication details
   */
  async _authenticateWithToken() {
    const tokenAuth = await validateMfsToken(this);
    
    if (!tokenAuth.valid) {
      this.warn(`[MEDIA_EXPORT] Token authentication failed: ${tokenAuth.error}`);
      return {
        authenticated: false,
        error: tokenAuth.error
      };
    }

    this.debug(`[MEDIA_EXPORT] Token authenticated successfully`);
    
    this.tokenAuth = tokenAuth;
    
    return {
      authenticated: true,
      pseudo_entity_uid: tokenAuth.pseudo_entity_uid,
      hub_id: tokenAuth.hub_id
    };
  }

  /**
   * Get manifest of a node (folder or file tree)
   * Supports token authentication via x-param-mfs-token header
   * 
   * Query parameters:
   * - hub_id: Hub ID
   * - nid: Node ID
   * 
   * Returns manifest data structure
   */
  async manifest() {
    try {
      const auth = await this._authenticateWithToken();
      if (!auth.authenticated) {
        return this.output.data({
          status: 'error',
          error: auth.error,
          message: 'Token authentication failed'
        });
      }

      const nodeId = this.input.get(Attr.nid);
      const hubId = this.input.get(Attr.hub_id);

      if (!nodeId || !hubId) {
        this.debug("[MEDIA_EXPORT] Missing required parameters");
        return this.output.data({
          status: 'error',
          error: 'missing_parameters',
          message: 'hub_id and nid are required'
        });
      }

      this.debug(`[MEDIA_EXPORT] Getting manifest: hub_id=${hubId}, node_id=${nodeId}`);

      // Use pseudo entity UID as user ID for permission check
      const pseudoUid = this.tokenAuth.pseudo_entity_uid;

      let manifestResult = await this.db.await_proc(
        'mfs_manifest',
        nodeId,
        pseudoUid,
        1 // show_nodes
      );

      // mfs_manifest returns multiple result sets
      // Result set 0: node list
      // Result set 1: total size
      // Result set 2: filename
      // Result set 3: stats by category
      // Result set 4: used size

      const nodes = toArray(manifestResult[0] || []);
      const totalSizeRow = toArray(manifestResult[1] || [])[0];
      const filenameRow = toArray(manifestResult[2] || [])[0];
      const statsByCategoryRows = toArray(manifestResult[3] || []);
      const usedSizeRow = toArray(manifestResult[4] || [])[0];

      this.debug(`[MEDIA_EXPORT] Manifest loaded: ${nodes.length} nodes`);

      const dirname = nodes.length > 0 ? nodes[0].ownpath.split('/').slice(0, -1).join('/') : '/';

      return this.output.data({
        status: 'ok',
        dirname: dirname,
        origin: `https://${this.input.host()}`,
        nodes: nodes,
        stats: {
          total_size: totalSizeRow ? totalSizeRow.total_size : 0,
          used_size: usedSizeRow ? usedSizeRow.used_size : 0,
          filename: filenameRow ? filenameRow.filename : '',
          by_category: statsByCategoryRows
        }
      });

    } catch (error) {
      this.warn("[MEDIA_EXPORT] Exception in manifest:", error.message);
      return this.output.data({
        status: 'error',
        error: 'internal_error',
        message: 'Failed to get manifest: ' + error.message
      });
    }
  }

  /**
   * Serve original file for download
   * Supports token authentication via x-param-mfs-token header
   * 
   * Query parameters:
   * - hub_id: Hub ID
   * - nid: Node ID
   * 
   * Streams file content directly
   */
  async orig() {
    try {
      const auth = await this._authenticateWithToken();
      if (!auth.authenticated) {
        return this.output.data({
          status: 'error',
          error: auth.error,
          message: 'Token authentication failed'
        });
      }

      const nodeId = this.input.get(Attr.nid);
      const hubId = this.input.get(Attr.hub_id);

      if (!nodeId || !hubId) {
        this.debug("[MEDIA_EXPORT] Missing required parameters");
        return this.output.data({
          status: 'error',
          error: 'missing_parameters',
          message: 'hub_id and nid are required'
        });
      }

      this.debug(`[MEDIA_EXPORT] Serving file: hub_id=${hubId}, node_id=${nodeId}`);

      // Use pseudo entity UID for permission check
      const pseudoUid = this.tokenAuth.pseudo_entity_uid;

      const hasPermission = await checkPermission(this, pseudoUid, nodeId, 1); // 1 = read
      if (!hasPermission) {
        this.warn(`[MEDIA_EXPORT] Permission denied for node ${nodeId}`);
        return this.output.data({
          status: 'error',
          error: 'permission_denied',
          message: 'Insufficient permission to access this file'
        });
      }

      let node = await this.db.await_proc('mfs_node_attr', nodeId);
      node = toArray(node)[0];

      if (!node || !node.id) {
        this.warn(`[MEDIA_EXPORT] Node not found: ${nodeId}`);
        return this.output.data({
          status: 'error',
          error: 'node_not_found',
          message: 'File not found'
        });
      }

      // Only serve files, not folders
      if (node.category === 'folder' || node.category === 'hub') {
        this.warn(`[MEDIA_EXPORT] Cannot serve folder/hub as file`);
        return this.output.data({
          status: 'error',
          error: 'invalid_type',
          message: 'Cannot download folders'
        });
      }

      this.debug(`[MEDIA_EXPORT] Serving file: ${node.user_filename}.${node.extension}`);

      // Use parent class method to serve file
      const { home_dir } = await this.db.await_proc('mfs_home');
      const filePath = `${home_dir}/__storage__/${node.id}/orig.${node.extension}`;

      return this.output.download(filePath, `${node.user_filename}.${node.extension}`);

    } catch (error) {
      this.warn("[MEDIA_EXPORT] Exception in orig:", error.message);
      return this.output.data({
        status: 'error',
        error: 'internal_error',
        message: 'Failed to serve file: ' + error.message
      });
    }
  }

}

module.exports = MediaExport;