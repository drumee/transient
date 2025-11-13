// service/import_google_drive.js

const { Attr } = require('@drumee/server-essentials');
const axios = require('axios');
const ImportBase = require('./import_base');

class ImportGoogleDrive extends ImportBase {

  initialize(opt) {
    super.initialize(opt);
    this.debug("ImportGoogleDrive Service Initialized.");
  }

  /**
   * Get Google OAuth access token
   */
  async _getAccessToken() {
    return super._getAccessToken('google');
  }

  /**
   * List files from Google Drive
   */
  async list_files() {
    const accessToken = await this._getAccessToken();
    const folderId = this.input.get('folder_id') || 'root';

    try {
      const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: {
          q: `'${folderId}' in parents and trashed = false`,
          pageSize: 50,
          fields: 'files(id, name, mimeType, iconLink, size, fileExtension, webViewLink, webContentLink)'
        }
      });
      this.output.data({ success: true, files: response.data.files });
    } catch (e) {
      this.warn(`[Import] Failed to list Google Drive files:`, e.response?.data || e.message);
      if (e.response && e.response.status === 401) {
        throw new Error("OAuth Token is invalid or expired. Please re-authenticate.");
      }
      throw new Error("Failed to list Google Drive files.");
    }
  }

  /**
   * Import file from Google Drive
   */
  async import_file() {
    const googleFileId = this.input.get('file_id');
    const destNodeId = this.input.get(Attr.nid);

    if (!googleFileId || !destNodeId) {
      throw new Error("Missing 'file_id' or 'nid' (destination folder ID) parameter.");
    }

    const accessToken = await this._getAccessToken();

    // Get file metadata from Google Drive
    let googleFile;
    try {
      const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${googleFileId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: {
          fields: 'id, name, mimeType, webContentLink, size, fileExtension'
        }
      });
      googleFile = response.data;

      // Handle Google Workspace files (Docs, Sheets, etc.) - need export
      if (!googleFile.webContentLink) {
        const GOOGLE_EXPORT_TYPES = {
          'google-apps.document': { mime: 'application/pdf', ext: 'pdf' },
          'google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
          'google-apps.presentation': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
          'google-apps.drawing': { mime: 'image/png', ext: 'png' }
        };

        let exportType = null;
        for (const [gType, exportInfo] of Object.entries(GOOGLE_EXPORT_TYPES)) {
          if (googleFile.mimeType.includes(gType)) {
            exportType = exportInfo;
            break;
          }
        }

        if (exportType) {
          googleFile.webContentLink = `https://www.googleapis.com/drive/v3/files/${googleFileId}/export?mimeType=${encodeURIComponent(exportType.mime)}`;
          googleFile.name = `${googleFile.name}.${exportType.ext}`;
          this.debug(`[Import] Exporting Google Workspace file as ${exportType.ext}`);
        } else {
          this.warn(`[Import] File ${googleFile.name} (mime: ${googleFile.mimeType}) is not downloadable.`);
          throw new Error("This file type is not directly downloadable or exportable.");
        }
      }
    } catch (e) {
      this.warn(`[Import] Failed to get Google file metadata:`, e.response?.data || e.message);
      throw new Error("Failed to get Google file metadata.");
    }

    // Get destination folder
    const destFolder = await this.db.await_proc('mfs_node_attr', destNodeId);
    if (!destFolder || !destFolder.home_dir) {
      throw new Error("Invalid destination folder ID (nid).");
    }

    const nodeAttributes = {
      mimetype: googleFile.mimeType,
      filesize: googleFile.size
    };

    // Import file using base class method
    const newNode = await this._importFileInternal(
      googleFile.webContentLink,
      googleFile.name,
      destFolder,
      nodeAttributes,
      accessToken
    );

    this.output.data({ success: true, node: newNode });
  }
}

module.exports = ImportGoogleDrive;