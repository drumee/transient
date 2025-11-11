// service/import_google_drive.js

const { Entity } = require('@drumee/server-core');
const { toArray, Attr, sysEnv, uniqueId, Network } = require('@drumee/server-essentials');
const { existsSync, mkdirSync, cpSync, statSync, rmSync } = require("fs");
const { join, extname, basename } = require("path");
const { createHash } = require("crypto");
const { tmp_dir } = sysEnv();
const axios = require('axios');
const { Mfs } = require("@drumee/server-core"); 

class ImportGoogleDrive extends Mfs {

  initialize(opt) {
    super.initialize(opt);
    this.debug("ImportGoogleDrive Service Initialized.");
  }

  /**
   *
   */
  async _getAccessToken() {
    const userId = this.uid;
    if (!userId) {
      throw new Error("User is not authenticated (this.uid is null).");
    }
    
    const tokenData = toArray(await this.yp.await_query(
      'SELECT access_token FROM oauth_accounts WHERE user_id = ? AND provider = ?',
      userId, 'google'
    ))[0];
    
    if (!tokenData || !tokenData.access_token) {
      this.warn(`[Import] User ${userId} has not linked Google account or token is missing.`);
      throw new Error("User has not linked Google account or token is missing.");
    }
    return tokenData.access_token;
  }

  /**
   *
   * 
   */
  async _importFileInternal(url, filename, destFolder, attr = {}, oauthToken = null) {
    const TMPDIR = `/${tmp_dir}/${uniqueId()}`;
    mkdirSync(TMPDIR, { recursive: true });
    
    const ext = extname(filename).replace(/^\.+/, '');
    const source = join(TMPDIR, `download.${ext}`);
    
    this.debug(`[Import] Importing from ${url} -> ${filename}`);
    
    const downloadOptions = {
      method: 'GET',
      outfile: source,
      url: url,
      headers: {}
    };

    if (oauthToken) {
      downloadOptions.headers['Authorization'] = `Bearer ${oauthToken}`;
    }
    
    await Network.request(downloadOptions); 
    const stat = statSync(source);
    
    let { filetype, mimetype } = attr;
    if (!filetype || !mimetype) {
      let r = await this.yp.await_query(
        `SELECT category filetype, mimetype FROM filecap WHERE extension = ?`, ext
      );
      ({ filetype, mimetype } = toArray(r)[0] || {});
    }
    if (!mimetype) mimetype = `application/${ext}`;
    if (!filetype) filetype = 'other'; 

    const args = {
      owner_id: destFolder.owner_id,
      filename: filename.replace(new RegExp(`\.(${ext})$`, 'i'), ''),
      pid: destFolder.nid,
      category: filetype,
      ext: ext,
      mimetype: mimetype,
      filesize: attr.filesize || stat.size,
      showResults: 1
    };
    
    const item = await this.db.await_proc("mfs_create_node", args, {}, { isOutput: 1 });
    if (!item || !item.id) {
      this.warn("Failed to create MFS node with", item, args);
      throw new Error("Failed to create MFS node.");
    }
    
    const base = join(destFolder.home_dir.replace(/(\/__storage__.*)$/, ''), '__storage__', item.id);
    const orig = join(base, `orig.${ext}`);
    mkdirSync(base, { recursive: true });
    
    this.debug(`[Import] Copying ${source} -> ${orig}`);
    cpSync(`${source}`, orig, { force: true });
    
    rmSync(TMPDIR, { recursive: true, force: true });
    
    this.debug(`[Import] ✓ Successfully imported ${filename} to ${item.file_path}`);
    return item;
  }

  /**
   * 
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
   *
   */
  async import_file() {
    const googleFileId = this.input.get('file_id'); 
    const destNodeId = this.input.get(Attr.nid);  

    if (!googleFileId || !destNodeId) {
      throw new Error("Missing 'file_id' or 'nid' (destination folder ID) parameter.");
    }

    const accessToken = await this._getAccessToken();

    let googleFile;
    try {
      const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${googleFileId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: {
          fields: 'id, name, mimeType, webContentLink, size, fileExtension' 
        }
      });
      googleFile = response.data;
      
      if (!googleFile.webContentLink) {
        if (googleFile.mimeType.includes('google-apps.document')) {
          googleFile.webContentLink = `https://www.googleapis.com/drive/v3/files/${googleFileId}/export?mimeType=application/pdf`;
          googleFile.name = `${googleFile.name}.pdf`;
        } else if (googleFile.mimeType.includes('google-apps.spreadsheet')) {
          googleFile.webContentLink = `https://www.googleapis.com/drive/v3/files/${googleFileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
          googleFile.name = `${googleFile.name}.xlsx`;
        } else {
          this.warn(`[Import] File ${googleFile.name} (mime: ${googleFile.mimeType}) is not downloadable.`);
          throw new Error("This file type (e.g., Google Doc, Sheet) is not directly downloadable or exportable.");
        }
      }
    } catch (e) {
      this.warn(`[Import] Failed to get Google file metadata:`, e.response?.data || e.message);
      throw new Error("Failed to get Google file metadata.");
    }
    
    const destFolder = await this.db.await_proc('mfs_node_attr', destNodeId);
    if (!destFolder || !destFolder.home_dir) {
      throw new Error("Invalid destination folder ID (nid).");
    }

    const nodeAttributes = {
      mimetype: googleFile.mimeType,
      filesize: googleFile.size
    };
    
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