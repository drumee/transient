const { makeHeaders } = require("./utils")


/**
 * 
 * @returns 
 */
function onReadyStateChange(r) {
  const { target } = r;
  if (!target || target.readyState !== 4) return;

  const { responseText, status } = target;
  if (status === 0) return;

  if (status !== 200) {
    if (this.onUploadError) {
      this.onUploadError(this.pendingItem);
    }
    return;
  }

  try {
    const { data } = JSON.parse(responseText);
    if (this.onUploadResponse) {
      this.onUploadResponse(data);
    }
  } catch (e) {
    this.warn("RESPONSE_PARSE_ERROR", e);
    if (this.onUploadError) {
      this.onUploadError(this.pendingItem);
    }
  }
}


/**
 * @param {any} url - url of backend service
 */
export function uploadFile(file, params) {
  let xhr = new XMLHttpRequest();
  let uploader = xhr.upload || xhr;
  if (this.onAbort) {
    uploader.onabort = this.onAbort.bind(this);
  }
  if (this.onReadystatechange) {
    uploader.onreadystatechange = this.onReadystatechange.bind(this);
  }
  if (this.onUploadError) {
    uploader.onerror = this.onUploadError.bind(this);
  }
  if (this.onLoad) {
    this.pendingItem = { ...params, file };
    uploader.onload = this.onLoad.bind(this);
  }
  if (this.onUploadEnd) {
    uploader.onloadend = this.onUploadEnd.bind(this);
  }
  if (this.onUploadProgress) {
    uploader.onprogress = this.onUploadProgress.bind(this);
  }

  xhr.onreadystatechange = onReadyStateChange.bind(this);
  const { svc } = bootstrap();
  let { service } = params;
  if (!service) {
    service = 'media.upload'
  } else {
    delete params.service;
  }
  xhr.open(_a.post, `${svc}${service}`, true);

  const opt = {
    filename: encodeURI(file.name),
    mimetype: file.type,
    filesize: file.size,
    socket_id: this.get(_a.socket_id) || Visitor.get(_a.socket_id),
    ...params
  };
  const _data = JSON.stringify(opt);
  makeHeaders({
    "Content-Type": "application/octet-stream; charset=utf-8",
    "x-param-xia-data": _data
  }, xhr)
  this.verbose(`Sending ${file.name} (${file.size})`);
  // console.log(`🔴 [XHR.SEND] Upload ACTUALLY starting NOW for file: ${file.name} at ${new Date().toISOString()}`);
  
  if (_.isFunction(file.file)) {
    file.file((f) => {
      // console.log(`🔴 [XHR.SEND] Sending FileEntry file: ${f?.name || 'unknown'} at ${new Date().toISOString()}`);
      xhr.send(f);
    })
  } else {
    try {
      // console.log(`🔴 [XHR.SEND] Sending File object: ${file.name} at ${new Date().toISOString()}`);
      xhr.send(file);
    } catch (error) {
      // console.error(`🔴 [XHR.SEND] Error sending file: ${file.name}`, error);
      if (this.onUploadError) {
        this.onUploadError({ error, file, params })
      }
    }
  }
  return xhr
}

