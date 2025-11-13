// service/import_dropbox.js

const { Attr } = require('@drumee/server-essentials');
const axios = require('axios');
const ImportBase = require('./import_base');

class ImportDropbox extends ImportBase {

  initialize(opt) {
    super.initialize(opt);
    this.debug("ImportDropbox Service Initialized.");
  }

  /**
   * Get Dropbox OAuth access token
   */
  async _getAccessToken() {
    return super._getAccessToken('dropbox');
  }

  /**
   * List files from Dropbox
   */
  async list_files() {
    const accessToken = await this._getAccessToken();
    const path = this.input.get('path') || '';

    try {
      const response = await axios.post('https://api.dropboxapi.com/2/files/list_folder',
        {
          path: path,
          limit: 50
        },
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

      this.output.data({ success: true, files: response.data.entries });
    } catch (e) {
      this.warn(`[Import] Failed to list Dropbox files:`, e.response?.data || e.message);
      if (e.response && e.response.status === 401) {
        throw new Error("OAuth Token is invalid or expired. Please re-authenticate.");
      }
      throw new Error("Failed to list Dropbox files.");
    }
  }

  /**
   * Import file from Dropbox
   */
  async import_file() {
    const dropboxFileId = this.input.get('file_id');
    const destNodeId = this.input.get(Attr.nid);

    if (!dropboxFileId || !destNodeId) {
      throw new Error("Missing 'file_id' or 'nid' (destination folder ID) parameter.");
    }

    const accessToken = await this._getAccessToken();

    // Get temporary download link from Dropbox
    let dropboxFile;
    let downloadUrl;
    try {
      const response = await axios.post('https://api.dropboxapi.com/2/files/get_temporary_link',
        {
          path: dropboxFileId
        },
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

      downloadUrl = response.data.link;
      dropboxFile = response.data.metadata;

      if (!downloadUrl) {
        throw new Error("Failed to get temporary download link from Dropbox.");
      }
    } catch (e) {
      this.warn(`[Import] Failed to get Dropbox file metadata:`, e.response?.data || e.message);
      throw new Error("Failed to get Dropbox file metadata.");
    }

    // Get destination folder
    const destFolder = await this.db.await_proc('mfs_node_attr', destNodeId);
    if (!destFolder || !destFolder.home_dir) {
      throw new Error("Invalid destination folder ID (nid).");
    }

    const nodeAttributes = {
      mimetype: dropboxFile['.tag'] === 'file' ? (dropboxFile.mime_type || 'application/octet-stream') : 'application/octet-stream',
      filesize: dropboxFile.size
    };

    // Import file using base class method
    // Note: Dropbox temporary link doesn't need OAuth header
    const newNode = await this._importFileInternal(
      downloadUrl,
      dropboxFile.name,
      destFolder,
      nodeAttributes,
      null
    );

    this.output.data({ success: true, node: newNode });
  }
}

module.exports = ImportDropbox;