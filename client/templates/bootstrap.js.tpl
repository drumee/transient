

<%= renderer.include('scripts.tpl') %>

  let el;
  <% _.each(bundles, function(m, k) { %>
    el = document.createElement('script');
    el.setAttribute('text', 'text/javascript');
    el.type = '<%= type %>';
    el.setAttribute('charset', "utf-8");
    el.setAttribute('crossorigin', "true");
    el.setAttribute('id', "bundles-<%= k %>");
    el.setAttribute('src', "<%= app.location %>/app/<%= m %>");
    document.head.appendChild(el);
  <% }); %>


