
  const xia_lang = "<%= language %>";
  const protocol = "<%= protocol %>";
  const bootstrap = function() {
    return {
      access        : "<%= access %>",
      appHash       : "<%= app.hash %>",
      appRoot       : "<%= appRoot %>",
      arch          : "<%= arch %>",
      area          : "<%= area %>",
      connection    : "<%= connection %>",
      endpoint      : "<%= endpointPath %>/",
      endpointName  : "<%= instance_name %>",
      endpointPath  : "<%= endpointPath %>/",
      ident         : "<%= ident %>",
      instance      : "<%= instance_name %>",
      instance_name : "<%= instance_name %>",
      keysel        : "<%= keysel %>",
      lang          : "<%= language %>",
      localhost     : <%= localhost %>,
      main_domain   : "<%= main_domain %>",
      mfs_base      : "<%= endpointPath %>/",
      mfsRootUrl    : `<%= endpointPath %>/`,
      online        : 1,
      pdfworker     : "<%= app.pdfworker %>",
      pdfworkerLegacy : "<%= app.pdfworkerLegacy %>",
      service       : "<%= servicePath %>?",
      serviceApi    : "<%= servicePath %>?",
      servicePath   : "<%= servicePath %>",
      serviceUrl    : "<%= protocol %>://<%= main_domain %><%= servicePath %>?",
      signed_in     : "<%= signed_in %>",
      static        : "<%= appRoot %>/static/",
      svc           : "<%= svcPath %>",
      uid           : "<%= uid %>",
      user_domain   : "<%= user_domain %>",
      vdo           : "<%= vdoPath %>",
      websocketApi  : "<%= ws_protocol %>://<%= main_domain %><%= websocketPath %>",
      websocketPath : "<%= websocketPath %>",
    };
  }

  const DEBUG =  {};

