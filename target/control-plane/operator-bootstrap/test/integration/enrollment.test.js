"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const runtime=require("@drumee/server-runtime"),api=require("../../lib"),{environment}=require("../helpers/database");
function intent(database,operation_id="initial-admin-0001",identity={username:"admin",email:"admin@drumee.lan"}){return{contract_version:1,database,domain:"drumee.lan",organisation_id:1,operation_id,identity,authorization:{authorized:true,scope:"initial-operator",operation_id,domain:"drumee.lan",organisation_id:1}};}
function resource(env,name,mode="automatic",extra={}){const directory=path.join(env.directory,name);fs.mkdirSync(directory,{mode:0o700});const file=path.join(directory,"credential");return {file,provider:api.createFileCredentialProvider({mode,file,...extra})};}
function retrieve(file,operation_id="initial-admin-0001"){return api.retrieveInitialCredential({file,authorization:{authorized:true,scope:"retrieve-initial-credential",operation_id}});}
test("KB-01B real SQL enrollment, credential durability, exclusivity and interrupted transaction recovery",{timeout:240000},async t=>{
 const env=await environment();let main,owner,provider,file;
 try{
  await t.test("test, interactive FD and automatic modes share actual sign-in and named platform policy",async()=>{
   for(const mode of ["test","interactive","automatic"]){const db=await env.database(mode),options=intent(db);await api.installOperatorSchema(options);let fd;
    const extra={};if(mode==="interactive"){const source=path.join(env.directory,"secure-input");fs.writeFileSync(source,crypto.randomBytes(32).toString("base64url"),{mode:0o600});fd=fs.openSync(source,"r");extra.password_fd=fd;}
    const prepared=resource(env,"credentials-"+mode,mode,extra);let result;
    try{result=await api.enrollInitialOperator({...options,credential_provider:prepared.provider});}finally{if(fd!==undefined)fs.closeSync(fd);}
    assert.equal(result.changed,true);assert.equal(result.policy,"PLATFORM_ADMINISTRATOR");assert.ok(!JSON.stringify(result).includes("password"));
    const credentials=retrieve(prepared.file),store=new runtime.YellowPageStore({database:db}),sessions=new runtime.SessionManager({store}),session=await sessions.fromRequest({headers:{}});
    await session.signin({uid:result.uid,password:credentials.password.toString()});assert.equal(session.isAuthenticated(),true);assert.equal(session.identity().kind,"drumate");assert.equal((await sessions.fromSessionId(session.sid)).isAuthenticated(),true);
    assert.equal((await new runtime.PlatformAuthorizer({store}).authorize({session,permission:{scope:"platform",src:"PLATFORM_ADMINISTRATOR"}})).granted,true);
    const bad=await sessions.fromRequest({headers:{}});await assert.rejects(bad.signin({uid:result.uid,password:"incorrect-credential"}),{code:"AUTHENTICATION_FAILED"});credentials.password.fill(0);
    if(mode==="automatic"){main=db;owner=result;provider=prepared.provider;file=prepared.file;}
   }
  });
  await t.test("idempotent installation and replay preserve UID, fingerprint, remit and credential file",async()=>{
   const before=(await main.query("SELECT id,fingerprint,remit FROM drumate WHERE id=?",owner.uid))[0],bytes=fs.readFileSync(file);
   assert.equal((await api.installOperatorSchema(intent(main))).valid,true);
   const repeated=await api.enrollInitialOperator({...intent(main),credential_provider:provider});assert.equal(repeated.uid,owner.uid);assert.equal(repeated.changed,false);
   assert.deepEqual((await main.query("SELECT id,fingerprint,remit FROM drumate WHERE id=?",owner.uid))[0],before);assert.deepEqual(fs.readFileSync(file),bytes);
   assert.equal((await api.validateInitialOperator({contract_version:1,database:main,domain:"drumee.lan",organisation_id:1})).valid,true);
  });
  await t.test("conflicting operation, identity or credential commitment cannot reset or enroll another administrator",async()=>{
   for(const [index,options] of [intent(main,"different-operation"),intent(main,"initial-admin-0001",{username:"someone",email:"someone@drumee.lan"}),intent(main)].entries()){
    const prepared=resource(env,"conflict-"+index);if(index===2){const {database,authorization,...binding}=options;(await prepared.provider.prepare(binding)).password.fill(0);}await assert.rejects(api.enrollInitialOperator({...options,credential_provider:prepared.provider}),{code:"OPERATOR_ENROLLMENT_CONFLICT"});
   }
   assert.equal((await main.query("SELECT COUNT(*) AS n FROM drumate WHERE remit=15"))[0].n,1);
  });
  await t.test("lost credential after completion fails closed without generating a replacement",async()=>{
   fs.renameSync(file,file+".saved");
   try {await assert.rejects(api.enrollInitialOperator({...intent(main),credential_provider:provider}),{code:"OPERATOR_CREDENTIAL_PREPARATION_FAILED"});assert.equal(fs.existsSync(file),false);assert.equal((await main.query("SELECT uid FROM initial_operator_enrollment"))[0].uid,owner.uid);}
   finally{fs.renameSync(file+".saved",file);}
  });
  await t.test("separate connections race for one initial administrator; conflicting operation loses",async()=>{
   const db=await env.database("race"),second=await env.connect("race");await api.installOperatorSchema(intent(db));
   const a=resource(env,"race-a"),b=resource(env,"race-b");
   const results=await Promise.allSettled([api.enrollInitialOperator({...intent(db,"race-operation-a"),credential_provider:a.provider}),api.enrollInitialOperator({...intent(second,"race-operation-b",{username:"other",email:"other@drumee.lan"}),credential_provider:b.provider})]);
   assert.equal(results.filter(value=>value.status==="fulfilled").length,1);assert.equal(results.find(value=>value.status==="rejected").reason.code,"OPERATOR_ENROLLMENT_CONFLICT");assert.equal((await db.query("SELECT COUNT(*) AS n FROM drumate WHERE remit=15"))[0].n,1);
  });
  await t.test("genuinely identical concurrent operation is created once and replayed once",async()=>{
   const db=await env.database("same_race"),second=await env.connect("same_race");await api.installOperatorSchema(intent(db));const prepared=resource(env,"same-race");
   const results=await Promise.all([api.enrollInitialOperator({...intent(db),credential_provider:prepared.provider}),api.enrollInitialOperator({...intent(second),credential_provider:prepared.provider})]);assert.equal(results[0].uid,results[1].uid);assert.deepEqual(results.map(value=>value.changed).sort(),[false,true]);
  });
  await t.test("two actual deployment processes cannot enroll two first administrators",async()=>{
   const db=await env.database("process_race");await api.installOperatorSchema(intent(db));
   const {execFile}=require("node:child_process");
   const requests=["a","b"].map(suffix=>{
    const prepared=resource(env,"process-"+suffix),options=intent(null,"process-operation-"+suffix,{username:"admin-"+suffix,email:"admin-"+suffix+"@drumee.lan"});delete options.database;
    const config=path.join(env.directory,"process-"+suffix+".json");fs.writeFileSync(config,JSON.stringify({port:env.port,password_file:env.password_file,database:"process_race",file:prepared.file,intent:options}),{mode:0o600});
    return new Promise((resolve,reject)=>execFile(process.execPath,[path.join(__dirname,"../helpers/enrollment-child.js"),config],{timeout:30000},(error,stdout)=>{if(error)return reject(Error("CHILD_PROCESS_FAILED"));try{resolve(JSON.parse(stdout));}catch(_){reject(Error("CHILD_PROTOCOL_FAILED"));}}));
   });
   const results=await Promise.all(requests);assert.equal(results.filter(value=>value.changed===true).length,1);assert.equal(results.filter(value=>value.code==="OPERATOR_ENROLLMENT_CONFLICT").length,1);assert.equal((await db.query("SELECT COUNT(*) AS n FROM drumate WHERE remit=15"))[0].n,1);
  });
  await t.test("all precommit interruption boundaries roll back humans and preserve prepared credentials for retry",async()=>{
   const phases=["before-credential","credential-prepared","before-transaction","principal-inserted","credential-inserted","remit-assigned","metadata-written","before-commit"];
   for(const [index,phase] of phases.entries()){
    const db=await env.database("interruption_"+index),options=intent(db),prepared=resource(env,"interruption-"+index);await api.installOperatorSchema(options);
    await assert.rejects(api.enrollInitialOperator({...options,credential_provider:prepared.provider,checkpoint(current){if(current===phase)throw Error("sensitive-detail-must-be-redacted");}}),error=>error.code==="OPERATOR_ENROLLMENT_FAILED"&&!JSON.stringify(error).includes("sensitive-detail"));
    assert.equal((await db.query("SELECT COUNT(*) AS n FROM entity WHERE area='personal'"))[0].n,0);assert.equal((await db.query("SELECT operation_id FROM initial_operator_enrollment"))[0].operation_id,null);
    const bytes=fs.existsSync(prepared.file)?fs.readFileSync(prepared.file):null;
    assert.equal((await api.enrollInitialOperator({...options,credential_provider:prepared.provider})).changed,true);if(bytes)assert.deepEqual(fs.readFileSync(prepared.file),bytes);
   }
  });
  await t.test("actual disconnected transaction rolls back; a new connection and persisted credential recover",async()=>{
   const db=await env.database("disconnect_case"),prepared=resource(env,"disconnect-credential");await api.installOperatorSchema(intent(db));
   await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:prepared.provider,checkpoint(phase){if(phase==="credential-inserted"){db.connection.destroy();throw Error("INTERRUPTED_CONNECTION");}}}),{code:"OPERATOR_ENROLLMENT_FAILED"});
   const next=await env.connect("disconnect_case");assert.equal((await next.query("SELECT COUNT(*) AS n FROM entity WHERE area='personal'"))[0].n,0);assert.equal((await api.enrollInitialOperator({...intent(next),credential_provider:prepared.provider})).changed,true);
  });
  await t.test("lost acknowledgment after commit replays through new provider and connection without regeneration",async()=>{
   const db=await env.database("committed_case"),prepared=resource(env,"committed-credential");await api.installOperatorSchema(intent(db));
   await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:prepared.provider,checkpoint(phase){if(phase==="after-commit")throw Error("LOST_ACK");}}),{code:"OPERATOR_ENROLLMENT_FAILED"});
   const before=(await db.query("SELECT uid,credential_commitment FROM initial_operator_enrollment"))[0],bytes=fs.readFileSync(prepared.file);await db.close();const next=await env.connect("committed_case");
   const replay=await api.enrollInitialOperator({...intent(next),credential_provider:api.createFileCredentialProvider({mode:"automatic",file:prepared.file})});assert.equal(replay.uid,before.uid);assert.equal(replay.changed,false);assert.deepEqual(fs.readFileSync(prepared.file),bytes);
  });
  await t.test("missing authority, missing authentication routine, wrong bootstrap and invalid provider fail closed",async()=>{
   const db=await env.database("missing_authority");await api.installOperatorSchema(intent(db));const prepared=resource(env,"missing-provider");
   await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:{mode:"invalid",prepare(){throw Error("NEVER");}}}),{code:"OPERATOR_CREDENTIAL_PROVIDER_INVALID"});
   await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:{mode:"automatic",prepare(){throw new api.OperatorBootstrapError("private-credential-never-disclose");}}}),error=>error.code==="OPERATOR_CREDENTIAL_PROVIDER_INVALID"&&!JSON.stringify(error).includes("private-credential"));
   await db.query("DROP FUNCTION get_remit");await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:prepared.provider}),{code:"OPERATOR_AUTHORITY_UNAVAILABLE"});assert.equal(fs.existsSync(prepared.file),false);
   const auth=await env.database("missing_auth");await api.installOperatorSchema(intent(auth));await auth.query("DROP PROCEDURE session_signin");await assert.rejects(api.enrollInitialOperator({...intent(auth),credential_provider:prepared.provider}),{code:"OPERATOR_AUTHENTICATION_UNAVAILABLE"});
   const bootstrap=await env.database("bad_bootstrap");await bootstrap.query("UPDATE sys_conf SET conf_value='bad' WHERE conf_key='guest_id'");await assert.rejects(api.installOperatorSchema(intent(bootstrap)),{code:"OPERATOR_PLATFORM_INVALID"});
  });
  await t.test("existing username, email and existing platform administrator reject first enrollment",async()=>{
   for(const [index,kind] of ["username","email","administrator"].entries()){
    const db=await env.database("collision_"+index);await api.installOperatorSchema(intent(db));const uid=(await db.query("SELECT uniqueId() AS id"))[0].id;
    await db.query("INSERT INTO drumate (id,username,domain_id,fingerprint,profile,remit) VALUES (?,?,1,'',?,?)",uid,kind==="username"?"admin":"existing",JSON.stringify({email:kind==="email"?"admin@drumee.lan":"existing@drumee.lan"}),kind==="administrator"?15:0);
    const prepared=resource(env,"collision-"+index);await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:prepared.provider}),{code:kind==="administrator"?"OPERATOR_ADMINISTRATOR_EXISTS":"OPERATOR_IDENTITY_CONFLICT"});
   }
  });
  await t.test("caller transactions and nontransactional identity tables are rejected before credential preparation",async()=>{
   const db=await env.database("unsafe_transaction"),prepared=resource(env,"unsafe-transaction");await api.installOperatorSchema(intent(db));
   await db.connection.beginTransaction();await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:prepared.provider}),{code:"OPERATOR_CONNECTION_NOT_IDLE"});await assert.rejects(api.installOperatorSchema(intent(db)),{code:"OPERATOR_CONNECTION_NOT_IDLE"});await db.connection.rollback();assert.equal(fs.existsSync(prepared.file),false);
   await db.query("ALTER TABLE entity ENGINE=MyISAM");await assert.rejects(api.enrollInitialOperator({...intent(db),credential_provider:prepared.provider}),{code:"OPERATOR_IDENTITY_SCHEMA_INVALID"});assert.equal(fs.existsSync(prepared.file),false);
  });
  await t.test("revoked/mismatched grant or corrupt completion metadata is detected and never repaired",async()=>{
   await main.query("UPDATE drumate SET remit=8 WHERE id=?",owner.uid);assert.equal((await api.validateInitialOperator({contract_version:1,database:main,domain:"drumee.lan",organisation_id:1})).valid,false);await assert.rejects(api.enrollInitialOperator({...intent(main),credential_provider:provider}),{code:"OPERATOR_STATE_CORRUPT"});assert.equal((await main.query("SELECT remit FROM drumate WHERE id=?",owner.uid))[0].remit,8);await main.query("UPDATE drumate SET remit=15 WHERE id=?",owner.uid);
   await main.query("UPDATE initial_operator_enrollment SET identity_commitment=REPEAT('0',64)");await assert.rejects(api.enrollInitialOperator({...intent(main),credential_provider:provider}),{code:"OPERATOR_STATE_CORRUPT"});
  });
 }finally{await env.close();}
});
