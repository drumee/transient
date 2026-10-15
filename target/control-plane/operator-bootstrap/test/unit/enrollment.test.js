"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), { EventEmitter } = require("node:events");
const api = require("../../lib"), { context, fingerprint } = require("../../lib/validation");
function intent() { return { contract_version: 1, domain: "drumee.lan", organisation_id: 1, operation_id: "operator-unit-1", identity: { username: "admin", email: "admin@drumee.lan" } }; }
function options() { const value = intent(); return { ...value, authorization: { ...value, scope: "initial-operator", authorized: true } }; }
function temporary(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), "kb01b-unit-")); fs.chmodSync(root,0o700); t.after(()=>fs.rmSync(root,{recursive:true,force:true})); return root; }
test("explicit version, organization, identity, domain and operation-bound authorization", () => {
  assert.equal(context(options()).identity.username,"admin");
  for (const change of [{contract_version:2},{organisation_id:undefined},{organisation_id:2},{domain:"bad;name"},{domain:""},{operation_id:"x"},{authorization:null},{authorization:{...options().authorization,operation_id:"other-operation"}},{identity:{username:"system",email:"system@drumee.lan"}},{identity:{username:"admin",email:"bad"}},{identity:{...intent().identity,remit:127}}]) assert.throws(()=>context({...options(),...change}),error=>/^OPERATOR_/.test(error.code));
});
test("fingerprint is canonical SHA512 and malformed representations fail",()=>{
  const password=crypto.randomBytes(24).toString("base64url"); assert.equal(fingerprint(Buffer.from(password)),crypto.createHash("sha512").update(password).digest("hex"));
  for(const value of [password,null,Buffer.from("short"),Buffer.alloc(129),Buffer.from("long-password\ninvalid")]) assert.throws(()=>fingerprint(value),{code:"OPERATOR_CREDENTIAL_INVALID"});
});
for(const mode of ["test","automatic"]) test(`${mode} persists a unique secret, preserves it and permits explicit retrieval only`,async t=>{
  const root=temporary(t),file=path.join(root,"credential"),provider=api.createFileCredentialProvider({mode,file});
  const first=await provider.prepare(intent()),second=await provider.prepare(intent()); assert.deepEqual(first.password,second.password); assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.throws(()=>api.retrieveInitialCredential({file}),{code:"OPERATOR_RETRIEVAL_AUTHORIZATION_REQUIRED"});
  const retrieved=api.retrieveInitialCredential({file,authorization:{authorized:true,scope:"retrieve-initial-credential",operation_id:intent().operation_id}}); assert.deepEqual(retrieved.password,first.password);
  const other=await api.createFileCredentialProvider({mode,file:path.join(root,"second")}).prepare(intent());assert.notDeepEqual(first.password,other.password);
  await assert.rejects(provider.prepare({...intent(),operation_id:"other-operation"}),{code:"OPERATOR_CREDENTIAL_RESOURCE_CONFLICT"});
  for(const value of [first,second,retrieved,other])value.password.fill(0);
});
test("interactive provider reads an owned private FD; rejects noninteractive fallback",async t=>{
  const root=temporary(t),input=path.join(root,"input"),password=crypto.randomBytes(24).toString("base64url");fs.writeFileSync(input,password+"\n",{mode:0o600});const fd=fs.openSync(input,"r");
  try{const material=await api.createFileCredentialProvider({mode:"interactive",file:path.join(root,"resource"),password_fd:fd}).prepare(intent());assert.equal(material.password.toString(),password);material.password.fill(0);}finally{fs.closeSync(fd);}
  await assert.rejects(api.createFileCredentialProvider({mode:"interactive",file:path.join(root,"no-tty"),input:{isTTY:false},output:{isTTY:false}}).prepare(intent()),{code:"OPERATOR_SECURE_INPUT_REQUIRED"});
  assert.equal(fs.existsSync(path.join(root,"no-tty")),false);
});
test("TTY input uses raw non-echoing mode, confirms and restores mode without outputting password",async()=>{
  const input=new EventEmitter(),modes=[],output_text=[]; input.isTTY=true;input.isRaw=false;input.resume=()=>{};input.pause=()=>{};input.setRawMode=value=>{modes.push(value);input.isRaw=value;};
  const secret=crypto.randomBytes(24).toString("base64url");const output={isTTY:true,write(value){output_text.push(value);if(value.includes("password:"))setImmediate(()=>input.emit("data",Buffer.from(secret+"\r")));}};
  const value=await api.promptPassword({input,output});assert.equal(value.toString(),secret);assert.deepEqual(modes,[true,false,true,false]);assert.ok(!output_text.join("").includes(secret));value.fill(0);
});
test("unsafe permissions, symlinks, hardlinks, corrupt state and stale locks fail closed",async t=>{
  const root=temporary(t),file=path.join(root,"resource"),provider=api.createFileCredentialProvider({mode:"automatic",file});(await provider.prepare(intent())).password.fill(0);
  fs.chmodSync(file,0o644);await assert.rejects(provider.prepare(intent()),{code:"OPERATOR_CREDENTIAL_RESOURCE_UNSAFE"});fs.chmodSync(file,0o600);
  const link=path.join(root,"hardlink");fs.linkSync(file,link);await assert.rejects(provider.prepare(intent()),{code:"OPERATOR_CREDENTIAL_RESOURCE_UNSAFE"});fs.unlinkSync(link);
  fs.renameSync(file,file+".saved");fs.symlinkSync(file+".saved",file);await assert.rejects(provider.prepare(intent()),{code:"OPERATOR_CREDENTIAL_RESOURCE_UNSAFE"});fs.unlinkSync(file);fs.renameSync(file+".saved",file);
  fs.writeFileSync(file+".lock","interrupted",{mode:0o600});await assert.rejects(provider.prepare(intent()),{code:"OPERATOR_CREDENTIAL_RESOURCE_BUSY"});assert.equal(fs.readFileSync(file+".lock","utf8"),"interrupted");fs.unlinkSync(file+".lock");
  fs.writeFileSync(file,"{broken");await assert.rejects(provider.prepare(intent()),error=>/^OPERATOR_CREDENTIAL_/.test(error.code));assert.equal(fs.readFileSync(file,"utf8"),"{broken");
});
test("credential providers reject invalid modes, unsafe paths and writable parent directories",async t=>{
  const root=temporary(t);assert.throws(()=>api.createFileCredentialProvider({mode:"generated",file:path.join(root,"x")}),{code:"OPERATOR_MODE_INVALID"});
  await assert.rejects(api.createFileCredentialProvider({mode:"test",file:"relative"}).prepare(intent()),{code:"OPERATOR_CREDENTIAL_PATH_INVALID"});
  fs.chmodSync(root,0o755);await assert.rejects(api.createFileCredentialProvider({mode:"test",file:path.join(root,"x")}).prepare(intent()),{code:"OPERATOR_CREDENTIAL_RESOURCE_UNSAFE"});fs.chmodSync(root,0o700);
});
test("pool-like adapters and unauthorized enrollment fail before credential acquisition",async()=>{
  let called=0;await assert.rejects(api.enrollInitialOperator({...options(),database:{query(){}},credential_provider:{mode:"test",prepare(){called++;}}}),{code:"OPERATOR_DEDICATED_CONNECTION_REQUIRED"});
  await assert.rejects(api.enrollInitialOperator({...options(),authorization:null,credential_provider:{mode:"test",prepare(){called++;}}}),{code:"OPERATOR_AUTHORIZATION_REQUIRED"});assert.equal(called,0);
});
