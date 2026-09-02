export ENDPOINT=<%= endpoint %>
export REMOTE_USER=<%= user %>
export UI_RUNTIME_HOST=<%= server %>
export BUILD_TARGET=<%= type %>
export UI_RUNTIME_PATH=<%= runtime_dir %>/ui/$ENDPOINT
export UI_BUILD_MODE=<%= build_mode %>
<% if (endpoint==="main") { %>
export PUBLIC_PATH=/-/$BUILD_TARGET/
<% } else { %> 
export PUBLIC_PATH=/-/$ENDPOINT/$BUILD_TARGET/
<% } %>