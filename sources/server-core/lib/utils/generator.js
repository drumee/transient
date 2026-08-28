
const {
  Script, Attr, sysEnv, Constants
} = require("@drumee/server-essentials");
const { server_location } = sysEnv();

const { existsSync } = require("fs");
const { readFileSync, writeFileSync } = require("jsonfile");
const { trim, isEmpty } = require("lodash");
const { exec, ln } = require("shelljs");
const { parse, resolve, join, normalize } = require("path");

const {
  remove_dir,
  move_dir,
  move_item,
  get_node_content,
  special_file,
  mkdir,
  get_image_dimension,
  walkDir,
  get_md5Hash
} = require("./mfs");

const {
  CARD,
  IMG_CONV,
  MIME_CSS,
  MIME_JPG,
  MIME_MP3,
  MIME_OGV,
  MIME_PNG,
  OGV_PLAY_OPT,
  QT_FAST,
  SASS,
  THUMBNAIL,
  VDO_CONV,
  VDO_CRD_OPT,
  VDO_VGN_OPT,
  VIGNETTE,
} = Constants;

/**
 *
 * @param {*} files
 * @param {*} format
 * @returns
 */
function add_image_size(files, format = CARD) {
  for (let file of files) {
    var file_path;
    file.gid = `${file.gid}`;
    file.nid = `${file.nid}`;
    const category = file.filetype;
    if ((category === "image" && file.ext !== "webp") || category === "video") {
      // Consufing _SYS_FILE_PATH_ vs _FILE_PATH_
      if (file.sys_file_path !== undefined) {
        file_path = normalize(file.sys_file_path);
      } else {
        file_path = normalize(file.file_path);
      }
      const p = parse(file_path);
      const f = join(p.dir, `${file.nid}-${format}.jpg`);
      const fsize = get_image_dimension(f);
      file.width = fsize.width;
      file.height = fsize.height;
    }
    delete file.sys_file_path;
    delete file.file_path;
  }
  return files;
}

/**
 *
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_stylesheet_stylesheet(output, orig) {
  output = normalize(output);
  if (existsSync(output)) {
    return MIME_JPG;
  }
  orig = normalize(orig);
  exec(SASS + `${orig}:${output}`);
  if (existsSync(output)) {
    return MIME_CSS;
  }
}

/**
 *
 * @param {*} output
 * @param {*} orig
 * @param {*} node
 * @returns
 */
function create_script_script(output, orig, node) {
  output = normalize(output);
  if (existsSync(output)) {
    return MIME_JPG;
  }
  orig = normalize(orig);
  exec(COFFEE + `-o ${output} -c ${orig}`);
  if (existsSync(output)) {
    return MIME_CSS;
  }
}

//----------------------------------------------------------------#
//                           Image section                        #
//----------------------------------------------------------------#

/**
 *
 * @param {*} output
 * @param {*} orig
 * @param {*} cmd
 * @returns
 */
function generate(output, orig, cmd) {
  if (existsSync(normalize(output))) {
    return MIME_PNG;
  }
  orig = orig + "[0]";
  cmd = cmd + " " + output;
  try {
    const r = execShell(cmd);
    if (r.code === 0) {
      return MIME_PNG;
    }
  } catch (e) {
    console.warn("Caught error", e);
    return null;
  }
  if (existsSync(output)) {
    return MIME_PNG;
  }
}

/**
 *
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_image_vignette(output, orig) {
  const cmd = `gm convert -auto-orient -thumbnail '100x100^' -gravity center ${orig} -extent 100x100 +profile \"*\"`;
  return generate(output, orig, cmd);
}

/**
 *
 */
function create_image_slide(output, orig) {
  const cmd = `gm convert -auto-orient -size '1024x1024>' ${orig} -resize 1024x1024 +profile \"*\"`;
  return generate(output, orig, cmd);
}

/**
 *
 */
function create_image_preview(output, orig) {
  const cmd = `gm convert -auto-orient -size '200x200>' ${orig} -resize 200x200 +profile \"*\"`;
  return generate(output, orig, cmd);
}

/**
 *
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_text_vignette(output, orig) {
  let opt = `-size 100x100 xc:white -font "FreeMono" -pointsize 12 -fill black `;
  const cmd = `gm convert ${opt} -draw @${orig}`;
  return generate(output, orig, cmd);
}

/**
 *
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_image_thumb(output, orig) {
  const cmd = `gm convert -auto-orient -size 600x600 ${orig} -resize 600x600 +profile \"*\"`;
  return generate(output, orig, cmd);
}

/**
 *
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_image_card(output, orig) {
  const cmd = `gm convert -auto-orient -thumbnail '460x260^' -gravity center ${orig} -extent 460x260 +profile \"*\"`;
  return generate(output, orig, cmd);
}


/**
 *
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_image_webp(output, orig) {
  const cmd = `gm convert -auto-orient -size '1500x1500>' ${orig} -resize 1500x1500`;
  return generate(output, orig, cmd);
}

/**
 * Tmp files already processed and moved to storage.
 * Clean tmp files
 */
/**
 *
 * @param {*} node
 * @param {*} info
 */
function freeMfsCache(node, info) {
  if (info.tmp_pdf && existsSync(info.tmp_pdf)) {
    if (existsSync(info.fastdir)) {
      console.log(`FREE FASTDIR`, info);
      let file = resolve(node.mfs_root, node.id, `info.json`);
      remove_dir(info.fastdir, 1);
      delete info.fastdir;
      delete info.tmp_pdf;
      writeFileSync(file, info);
    }
  }
}

/**
 * 
 * @param {*} node 
 * @param {*} force 
 */
function create_document_index(node, force = 0) {
  let pdf_file;
  const mfs_dir = resolve(node.mfs_root, node.id);
  const orig = `${mfs_dir}/orig.${node.ext}`;
  const infofile = resolve(mfs_dir, `info.json`);
  let json = get_document_info(node, 1) || {};
  console.log("AAA:304", infofile, mfs_dir, node, json);
  if (node.ext == "pdf") {
    pdf_file = orig;
  } else if (json.pdf) {
    pdf_file = json.pdf;
    //let doc = Fs.readFileSync(name , 'utf8');
  } else if (json.mfs_pdfout) {
    if (/^.+(orig.pdf)$/.test(json.mfs_pdfout)) {
      pdf_file = json.mfs_pdfout;
    } else {
      pdf_file = resolve(json.mfs_pdfout, "orig.pdf");
    }
  }
  if (!existsSync(pdf_file)) {
    if (json.fastdir && existsSync(json.fastdir)) {
      pdf_file = resolve(json.fastdir, "pdfout", "orig.pdf");
      let outdir = resolve(json.fastdir, "pdfout");
      mkdir(outdir);
      let orig = resolve(json.fastdir, `orig.${node.ext}`);
      if (existsSync(orig)) {
        let cmd = `${Script.soffice} ${outdir} ${orig}`;
        execShell(cmd);
        let mfs_pdfout = resolve(mfs_dir, "pdfut");
        json.mfs_pdfout = mfs_pdfout;
        move_item(outdir, mfs_dir);
        delete json.fastdir;
        writeFileSync(infofile, json);
      } else {
        throw `File not found ${pdf_file}`;
      }
    }
  }

  let args = {
    db_name: node.db_name,
    extension: node.ext,
    id: node.id,
    hub_id: node.hub_id,
    mfs_root: node.mfs_root,
    detached: 1,
    file_path: node.file_path,
    uid: node.owner_id,
    file: pdf_file,
  };
  if (existsSync(pdf_file)) {
    const Spawn = require("child_process").spawn;
    let cmd = resolve(server_location, "offline", "media", "seo.js");
    console.log(
      `Creating document index with\n ${cmd} '${JSON.stringify(args)}'`
    );
    let child = Spawn(cmd, [JSON.stringify(args)], { detached: true });
    child.unref();
  } else {
    throw `File not found ${pdf_file}`;
  }
}

/**
 *
 * @param {*} pdf
 * @returns
 */
function get_pdfinfo(pdf) {
  if (!existsSync(pdf)) return { error: "FILE_NOT_FOUND" };
  let json = {};
  const str = exec(`/usr/bin/pdfinfo ${pdf}`).stdout;
  const lines = str.split(/\n/);
  for (let line of lines) {
    const a = line.split(":");
    json[a[0].toLowerCase()] = trim(a[1]);
  }
  json.pdf = pdf;
  if (json.pages) json.pages = parseInt(json.pages);
  return json;
}

/**
 *
 * @param {*} node
 * @returns
 */
function get_pdf_path(node, json) {
  if (node.ext == Attr.pdf) {
    return resolve(mfs_dir, "orig.pdf");
  } else {
    let pdf = resolve(mfs_dir, "pdfout", "orig.pdf");
    if (existsSync(pdf)) return pdf;
  }
}

/**
 *
 * @param {*} node
 * @returns
 */
function get_document_info(node, page) {
  const mfs_dir = resolve(node.mfs_root, node.id);
  const mfs_pdfout = join(mfs_dir, "pdfout");
  const info = resolve(mfs_dir, `info.json`);
  let json = {};
  let outdir = null;
  let orig = null;
  let cmd = null;
  let pdf = null;
  if (node.ext == Attr.pdf) {
    pdf = resolve(mfs_dir, "orig.pdf");
  } else {
    pdf = resolve(mfs_dir, "pdfout", "orig.pdf");
  }
  if (existsSync(info)) {
    json = readFileSync(info);
  } else {
    json = get_pdfinfo(pdf);
  }
  if (json.pages) {
    if (existsSync(pdf)) {
      freeMfsCache(node, json);
      if (json.pdf != pdf) {
        json.pdf = pdf;
        writeFileSync(info, json);
      }
      return json;
    }
  }
  if (json.fastdir && existsSync(json.fastdir)) {
    outdir = resolve(json.fastdir, "pdfout");
    let tmp_pdf = resolve(outdir, "orig.pdf");
    mkdir(outdir);
    orig = resolve(json.fastdir, `orig.${node.ext}`);
    if (existsSync(orig)) {
      cmd = `${Script.soffice} ${outdir} ${orig}`;
      execShell(cmd);
      json = { ...json, ...get_pdfinfo(tmp_pdf) };
      json.mfs_pdfout = mfs_pdfout;
      json.pdf = resolve(mfs_pdfout, "orig.pdf");
      json.tmp_pdf = tmp_pdf;
      writeFileSync(info, json);
      console.log(`CONVERT 471 cmd=${cmd}`, json);
      move_dir(tmp_pdf, json.pdf);
    } else {
      json.error = "FILE_NOT_FOUND";
    }
    if (existsSync(json.pdf) || existsSync(tmp_pdf)) {
      return json;
    }
  }

  orig = resolve(mfs_dir, `orig.${node.ext}`);
  if (node.ext != Attr.pdf && existsSync(orig) && !existsSync(pdf)) {
    if (!existsSync(mfs_pdfout)) mkdir(mfs_pdfout);
    cmd = `${Script.soffice} ${mfs_pdfout} ${orig}`;
    pdf = resolve(mfs_pdfout, "orig.pdf");
    console.log(`CONVERT 501 cmd=${cmd}`, json);
    execShell(cmd);
    writeFileSync(info, { ...get_pdfinfo(pdf), pdf });
  } else {
    json.error = "FILE_NOT_FOUND";
  }

  console.log(`STAGE 1 : mfs_dir=${mfs_dir} CMD=**${cmd}**`);
  return json;
}

/**
 * 
 * @param {*} mfs_dir 
 * @param {*} fname 
 */
function probe_streams(file) {
  const cmd = `/usr/bin/ffprobe -v quiet -print_format json -show_format -show_streams ${file}`;
  //console.log(`VIDEO INFO : ${cmd} `);
  try {
    return JSON.parse(execShell(cmd).stdout);
  } catch (e) {
    return {};
  }

}
/**
 * 
 * @param {*} node 
 * @returns 
 */
function get_video_info(node) {
  let json;
  const mfs_dir = resolve(node.mfs_root, node.id);

  const info = `${mfs_dir}/info.json`;
  if (!existsSync(info)) {
    json = {
      orig: probe_streams(join(mfs_dir, `orig.${node.ext}`)),
      stream: probe_streams(join(mfs_dir, "stream.mp4")),
    };
    try {
      delete json.orig.format.filename;
      delete json.stream.format.filename;
    } catch (error) { }
    writeFileSync(info, json);
  }
  try {
    json = readFileSync(info);
  } catch (error1) {
    json = {};
  }
  return json;
}

/**
 * 
 * @param {*} node 
 * @returns 
 */
async function get_mm_info(node) {
  const mfs_dir = `${node.mfs_root}${node.id}`;
  const orig = `${mfs_dir}/orig.${node.ext}`;
  const info = `${mfs_dir}/info.json`;
  let json = {};
  if (existsSync(info)) {
    try {
      json = readFileSync(info);
    } catch (e) {
      console.warn(`${__filename}:`, e);
    }
    return json;
  }
  if (!existsSync(orig)) {
    return {};
  }
  let metadata = {};
  try {
    const Metadata = require("music-metadata");
    metadata = await Metadata.parseFile(orig);
    let picture = Metadata.selectCover(metadata.common.picture);
    if (picture) {
      delete metadata.common.picture;
      metadata.cover = `data:${picture.format};base64,${picture.data.toString(
        "base64"
      )}`;
    }
    writeFileSync(info, metadata);
  } catch (e) {
    console.warn(`Failed to parse:`, orig);
    metadata.stats = node;
    metadata.common = {
      title: node.filename,
      artist: `Unknown (${node.firstname || ""} ${node.lastname || ""})`,
    };
    writeFileSync(info, metadata);
  }
  return metadata;
}

/**
 * 
 * @param {*} node 
 * @returns 
 */
function get_image_info(node) {
  let json;
  let target_mfs_dir;
  if (!isEmpty(node.targt_nid)) {
    target_mfs_dir = `${node.target_mfs_root}${node.target_nid}`;
  }
  const mfs_dir = target_mfs_dir || `${node.mfs_root}${node.id}`;
  const orig = `${mfs_dir}/orig.${node.ext}`;
  const info = `${mfs_dir}/info.json`;
  if (!existsSync(orig)) {
    return {};
  }

  if (existsSync(info)) {
    try {
      json = readFileSync(info);
    } catch (error) {
      json = {};
    }
    return json;
  }

  const cmd = `/usr/bin/gm identify -verbose ${orig}`;

  const s = execShell(cmd);
  if (s.error) {
    writeFileSync(info, { Image: {} });
    return { Image: {} };
  }

  let r = s.stdout;
  let j = r.replace(orig, "");
  try {
    const Yaml = require("js-yaml");
    json = Yaml.safeLoad(j, "utf8");
    writeFileSync(info, json);
    return json;
  } catch (e) {
    console.warn("FAILED TO PARSE METADATA", orig, e.reason);

    writeFileSync(info, { Image: {} });
    return { Image: {} };
  }
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_image_theme(output, orig) {
  output = normalize(output);
  if (existsSync(output)) {
    return MIME_JPG;
  }
  orig = normalize(orig);
  orig = orig + "[0]";
  exec(IMG_CONV + ` -sample '1920x1920>' ${orig} ${output}`);
  if (existsSync(output)) {
    return MIME_JPG;
  }
}

// ----------------------------------------------------------------#
//                        Images handling                          #
// ----------------------------------------------------------------#

/**
 * 
 * @param {*} node 
 * @param {*} angle 
 * @returns 
 */
async function rotate_image(node, angle = 90) {
  const mfs_dir = join(node.mfs_root, node.id);

  const orig = `${mfs_dir}/orig.${node.ext}`;
  if (!existsSync(orig)) {
    return null;
  }
  let files = await walkDir(mfs_dir);
  let hash;
  for (let file of files) {
    let { path } = file;
    if (/\/(theme|webp|slide|orig|vignette|thumb|card).*\..+/.test(path)) {
      const cmd = `gm mogrify -rotate ${angle} ${path}`;
      execShell(cmd);
      if (/\/orig.*\..+/.test(path)) {
        hash = await get_md5Hash(path);
      }
    }
  }
  return hash;
}

// ----------------------------------------------------------------#
//                        Document section                         #
// ----------------------------------------------------------------#

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_document_vignette(output, orig) {
  return create_image_vignette(output, orig);
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_document_thumb(output, orig) {
  return create_image_thumb(output, orig);
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_document_card(output, orig) {
  return create_image_card(output, orig);
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_document_browse(output, orig) {
  return create_image_browse(output, orig);
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_document_slide(output, orig) {
  return create_image_slide(output, orig);
}

//----------------------------------------------------------------#
//                        Audio section                           #
//----------------------------------------------------------------#


/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_audio_vignette(output, orig) {
  return create_image_vignette(output, orig);
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_audio_thumb(output, orig) {
  return create_image_thumb(output, orig);
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_audio_browse(output, orig) {
  return create_image_browse(output, orig);
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_audio_slide(output, orig) {
  return create_image_slide(output, orig);
}

/* ================================================================
 * Convert audio file into a format usable by our player (i.e jw)
 * ================================================================
 */

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_audio_stream(output, orig) {
  if (existsSync(output)) {
    return MIME_MP3;
  }

  if (/\/.{1}\.mp3$/i.test(orig)) {
    Fs.linkSync(orig, output);
    return existsSync(output);
  }
  let cmd = `ffmpeg -i ${orig} -acodec mp3 -ac 2 -ab 192k ${output}`;
  console.log(`output=${output} orig=${orig}`, cmd);
  execShell(cmd);
  // ffmpeg -i my.m4a -acodec mp3 -ac 2 -ab 192k my.mp3

  if (existsSync(output)) {
    return MIME_MP3;
  }
  return null;
}

/**
 * 
 */
function execShell(cmd) {
  const s = exec(cmd, { silent: true });
  if (s.code != 0) {
    console.log(`Failed to run ${cmd}`);
  }
  return s;
}

//----------------------------------------------------------------#
//                        Video section                           #
// ---------------------------------------------------------------#

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_video_card(output, orig) {
  if (existsSync(output)) {
    return MIME_JPG;
  }
  const cmd = VDO_CONV + `-i ${orig}` + VDO_CRD_OPT + output;
  execShell(cmd);
  if (existsSync(output)) {
    return MIME_JPG;
  }
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function reate_video_slide(output, orig) {
  if (existsSync(output)) {
    return MIME_JPG;
  }
  const cmd = VDO_CONV + `-i ${orig}` + VDO_CRD_OPT + output;
  exec(VDO_CONV + `-i ${orig}` + VDO_CRD_OPT + output);
  if (existsSync(output)) {
    return MIME_JPG;
  }
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_video_vignette(output, orig) {
  if (existsSync(output)) {
    return MIME_JPG;
  }
  const card = output.replace(/-vignette./g, "-card");
  if (!create_video_card(card, orig)) {
    return false;
  }
  const cmd =
    IMG_CONV +
    VDO_VGN_OPT +
    `${card} -page +38+38 ${output}`;
  execShell(cmd);
  if (existsSync(output)) {
    return MIME_JPG;
  }
}

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_video_thumb(output, orig) {
  if (existsSync(output)) {
    return MIME_JPG;
  }
  const cmd = VDO_CONV + `-i ${orig}` + VDO_THB_OPT + `${output}`;
  execShell(cmd);
  if (existsSync(output)) {
    return MIME_JPG;
  }
}

/**
 * 
 * @param {*} orig 
 * @returns 
 */
function get_codec(orig) {
  let cmd = `ffprobe -loglevel error -select_streams v -show_entries stream=codec_name -of default=nw=1:nk=1 ${orig}`;
  const str = execShell(cmd).stdout;
  try {
    return str.split([/\n ,;/])[0].trim();
  } catch (e) {
    return "";
  }
}

/**
 * Convert video file into H264, usable our player and HTML5
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_video_stream(output, orig) {
  if (existsSync(output)) {
    return MIME_MP4;
  }
  let codec = get_codec(orig);
  if (codec == "h264") {
    console.log(`${orig}  is already h264 **`, output);
    exec(`ffmpeg -i ${orig} -c copy -map 0 -movflags +faststart ${output}`);
    if (existsSync(output)) {
      // Fs.statSync(tmp).isFile()
      exec(`mv ${output} ${orig}`);
      ln("-sf", orig, output);
      return MIME_MP4;
    }
  }

  let cmd = `ffmpeg -i ${orig}  -y ${output}`;
  console.log(`running **${cmd}**`);
  execShell(cmd);

  const tmp = `${output}.tmp`;
  exec(QT_FAST + `${output} ${tmp}`);
  if (existsSync(tmp)) {
    // Fs.statSync(tmp).isFile()
    exec(`mv ${tmp} ${output}`);
  }
  if (existsSync(output)) {
    return MIME_MP4;
  }
}

/**
 * Convert video file into H264 container and split into live stream parte,
 * usable our player and HTML5
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_hls_args(node) {
  const input = get_node_content(node);
  let info = get_video_info(node).orig;
  if (!info || !info.streams || !info.streams.length) {
    console.log(`VIDEO INFO : `, input, info, node);
    console.error("INVALID VIDEO INFO");
    return null;
  }

  let width, height = 600;
  let hasAudio = false;
  for (let stream of info.streams) {
    if (stream.codec_type == Attr.video) {
      width = stream.width;
      height = stream.height;
    }
    if (stream.codec_type == Attr.audio) {
      hasAudio = true;
    }
  }
  let preset = "-preset veryfast -g 25 -sc_threshold 0";
  let v_codec = "libx264";
  let a_codec = "aac";
  let a_map = "";

  if (hasAudio) {
    var_stream_map = "v:0,a:0";
    a_map = `-map a:0 -c:a:0 ${a_codec} -b:a:0 96k -ac 2`;
  } else {
    var_stream_map = "v:0";
  }

  let res = [
    "-y",
    "-i",
    input,
    `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"`,
    `-c:v:0 ${v_codec} -b:v:0 6M ${preset}`,
    "-f hls",
    "-hls_time 2",
    "-hls_list_size 0",
    "-hls_flags independent_segments",
    "-hls_segment_type mpegts",
    "-hls_segment_filename stream-%v/segment-%06d.ts",
    "-master_pl_name master.m3u8",
    "stream-%v/playlist.m3u8",
  ];
  let r = res.flat();
  return r;
}

/**
 * Convert video file into H264, usable our player and HTML5
 * ffmpeg -re -i "Introducing App Platform by DigitalOcean-iom_nhYQIYk.mkv" -c:v copy -c:a aac -ar 44100 -ac 1 -f flv rtmp://localhost/live/stream
 * @param {*} output
 * @param {*} orig
 * @returns
 */
function create_video_segment(output, orig) {
  let mimetype = "video/MP2T";
  if (existsSync(output)) {
    return mimetype;
  }

  let options =
    "-c:v libx264 -crf 21 -preset veryfast -g 25 -sc_threshold 0 -c:a aac -b:a 128k -ac 2 -f hls -hls_time 4 -hls_playlist_type vod";
  let cmd = `ffmpeg -i ${orig} ${options} -y ${output}`;
  console.log(`running **${cmd}**`);
  execShell(cmd);

  if (existsSync(output)) {
    return mimetype;
  }
}

/* 
 * ================================================================
 * Convert video file into a format ogg video format, usable HTML5
 * ================================================================
 */

/**
 * 
 * @param {*} output 
 * @param {*} orig 
 * @returns 
 */
function create_video_ogv(output, orig) {
  if (existsSync(output)) {
    return MIME_OGV;
  }
  exec(VDO_CONV + `-i ${orig}` + OGV_PLAY_OPT + output);
  if (existsSync(output)) {
    return MIME_OGV;
  }
}

/**
 *
 * @param {*} nid
 * @param {*} ext
 * @param {*} orig
 */
function create_avatar(nid, ext, home_dir, orig) {
  const filepath = join(home_dir, "__config__", "icons");
  let output = `${filepath}/${special_file(nid, ext, VIGNETTE)}`;
  let cmd = `gm convert -auto-orient -thumbnail '100x100^' -gravity center ${orig} -extent 100x100 +profile \"*\" ${output}`;
  execShell(cmd);

  output = `${filepath}/${special_file(nid, ext, THUMBNAIL)}`;
  cmd = `gm convert -auto-orient -size 600x600 ${orig} -resize 600x600 +profile \"*\" ${output}`;
  execShell(cmd);

  output = `${filepath}/${special_file(nid, ext, CARD)}`;
  cmd = `gm convert -auto-orient -thumbnail '460x260^' -gravity center ${orig} -extent 460x260 +profile \"*\" ${output}`;
  execShell(cmd);
}


module.exports = {
  add_image_size,
  create_audio_browse,
  create_audio_slide,
  create_audio_stream,
  create_audio_thumb,
  create_audio_vignette,
  create_avatar,
  create_document_browse,
  create_document_card,
  create_document_index,
  create_document_slide,
  create_document_thumb,
  create_document_vignette,
  create_hls_args,
  create_image_card,
  create_image_theme,
  create_image_thumb,
  create_image_preview,
  create_image_slide,
  create_image_vignette,
  create_image_webp,
  create_script_script,
  create_stylesheet_stylesheet,
  create_text_vignette,
  create_video_card,
  create_video_ogv,
  create_video_segment,
  create_video_stream,
  create_video_thumb,
  create_video_vignette,
  freeMfsCache,
  get_codec,
  get_document_info,
  get_image_info,
  get_mm_info,
  get_pdf_path,
  get_pdfinfo,
  get_video_info,
  reate_video_slide,
  rotate_image,
};
