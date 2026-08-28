/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.gnu.org/licenses/agpl-3.0.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
require('@drumee/server-core/addons');
const Logger    = require('@drumee/server-core/log/console');
const Path = require('path');
const fs = require('fs');
const Cache     = require('../../dataset/cache');
let cache = new Cache();
let base = process.env.DRUMEE_FRONTEND_HOME;
let instance = process.env.instance_name || process.env.USER;
let mode = process.env.instance_mode || 'build';
//joining path of directory 
const directoryPath = Path.join(base, mode, instance);
console.log("directoryPath", directoryPath);
// fs.readdir(directoryPath, function (err, files) {
//   //handling error
//   if (err) {
//       return console.log('Unable to scan directory: ' + err);
//   } 
//   //listing all files using forEach
//   files.forEach(function (file) {
//       // Do whatever you want to do with the file
//       console.log(file); 
//   });
// });
