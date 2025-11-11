// service/import_dropbox.js

const { Entity } = require('@drumee/server-core');
const { toArray, Attr, sysEnv, uniqueId, Network } = require('@drumee/server-essentials');
const { existsSync, mkdirSync, cpSync, statSync, rmSync } = require("fs");
const { join, extname, basename } = require("path");
const { tmp_dir } = sysEnv();
const axios = require('axios');
const { Mfs } = require("@drumee/server-core"); 
class ImportDropbox extends Mfs {

  initialize(opt) {
    super.initialize(opt);
    this.debug("ImportDropbox Service Initialized.");
  }

  async _importFileInternal(url, filename, destFolder, attr = {}, oauthToken = null) {
    const TMPDIR = `/${tmp_dir}/${uniqueId()}`;
    mkdirSync(TMPDIR, { recursive: true });
    const ext = extname(filename).replace(/^\.+/, '');
    const source = join(TMPDIR, `download.${ext}`); 
    this.debug(`[Import] Importing from ${url} -> ${filename}`);
    const downloadOptions = { method: 'GET', outfile: source, url: url, headers: {} };
    if (oauthToken) {
      downloadOptions.headers['Authorization'] = `Bearer ${oauthToken}`;
    }
    await Network.request(downloadOptions); 
    const stat = statSync(source);
    let { filetype, mimetype } = attr;
    if (!filetype || !mimetype) {
      let r = await this.yp.await_query(`SELECT category filetype, mimetype FROM filecap WHERE extension = ?`, ext);
      ({ filetype, mimetype } = toArray(r)[0] || {});
    }
    if (!mimetype) mimetype = `application/${ext}`;
    if (!filetype) filetype = 'other'; 
    const args = {
      owner_id: destFolder.owner_id,
      filename: filename.replace(new RegExp(`\.(${ext})$`, 'i'), ''), 
      pid: destFolder.nid, 
      category: filetype, ext: ext, mimetype: mimetype,
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
  async _getAccessToken() {
    const userId = this.uid;
    if (!userId) throw new Error("User is not authenticated (this.uid is null).");
    
    const tokenData = toArray(await this.yp.await_query(
      'SELECT access_token FROM oauth_accounts WHERE user_id = ? AND provider = ?',
      userId, 'dropbox'
    ))[0];
    
    if (!tokenData || !tokenData.access_token) {
      this.warn(`[Import] User ${userId} has not linked Dropbox account or token is missing.`);
      throw new Error("User has not linked Dropbox account or token is missing.");
    }
    return tokenData.access_token;
  }

  /**
   *
   */
  async list_files() {
    const accessToken = await this._getAccessToken();
    const path = this.input.get('path') || ''; // Dropbox uses 'path' ('/FolderA')

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
      throw new Error("Failed to list Dropbox files.");
    }
  }

  /**
   * 
   */
  async import_file() {
    const dropboxFileId = this.input.get('file_id'); 
    const destNodeId = this.input.get(Attr.nid); 

    if (!dropboxFileId || !destNodeId) {
      throw new Error("Missing 'file_id' or 'nid' (destination folder ID) parameter.");
    }

    const accessToken = await this._getAccessToken();

    let dropboxFile;
    let downloadUrl;
    try {
      const response = await axios.post('https://api.dropboxapi.com/2/files/get_temporary_link', 
      {
        path: dropboxFileId // Dropbox uses path or ID (e.g: 'id:...')
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
    
    const destFolder = await this.db.await_proc('mfs_node_attr', destNodeId);
    if (!destFolder || !destFolder.home_dir) {
      throw new Error("Invalid destination folder ID (nid).");
    }

    const nodeAttributes = {
      mimetype: dropboxFile.mime_type || 'application/octet-stream',
      filesize: dropboxFile.size
    };
    
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