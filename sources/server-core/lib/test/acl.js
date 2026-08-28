
const Acl = require('../acl');
function check(service){
  console.log(`Checking ================ ${service} ===========`);
  for(let mode of [0, 1]){
    let access = mode? 'public': 'private';
    console.log(`Access ${access} **********************`);
    let w = Acl.getWorker(service, mode);
    if(w.error){
      console.error(`Check failed for ${service}`, w.error);
    }else{
      console.log(`worker`, w);
    }
    console.log(`permission`, Acl.permission(service));
  }
}

(async()=>{
  new Acl();
  await Acl.loadWorkers("../server/service/acl");
  for(let s of ['yp.get_env', 'media.copy']){
    check(s);
  }
  //console.log(process.env)
  process.exit(0);
})()