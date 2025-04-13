#!/bin/bash

# ============================================================================= 
# @license
# Copyright 2024 Thidima SA. All Rights Reserved.
# Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# https://www.gnu.org/licenses/agpl-3.0.html
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# =============================================================================
source /etc/drumee/drumee.sh
wd=$(dirname $(readlink -f $0 ))
cd $wd
if [ -z $1 ]; then 
  count=1
else 
  count=$1
fi

su -s /bin/bash $DRUMEE_SYSTEM_USER -c "HOME=$DRUMEE_SERVER_HOME \
  $wd/offline/factory.hub.js --schemas=$wd/schemas --count=$count"
