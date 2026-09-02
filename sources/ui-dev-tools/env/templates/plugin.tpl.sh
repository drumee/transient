export REMOTE_USER=<%= user %>
export BUILD_TARGET=<%= plugin %>
export UI_RUNTIME_HOST=<%= server %>
export UI_RUNTIME_PATH=<%= runtime_dir %>/plugins/ui/<%= endpoint %>/$BUILD_TARGET
export UI_BUILD_PATH=$HOME/build/<%= endpoint %>/plugins/$BUILD_TARGET
export UI_BUILD_MODE=<%= build_mode %>
export OUTPUT_FILENAME="[name]-[fullhash].js"
<% if (endpoint==="main") { %>
export PUBLIC_PATH=/-/plugins/$BUILD_TARGET/ 
<% } else { %> 
export PUBLIC_PATH=/-/<%= endpoint %>/plugins/$BUILD_TARGET/
<% } %>