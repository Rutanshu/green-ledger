const fs=require('fs');
const m=require('@prisma/internals');
const schema=fs.readFileSync('./prisma/schema.prisma','utf8');
const container={ files:[{path:'schema.prisma', content:schema}] };
(async()=>{
try{
  m.validate({ schemas:[['schema.prisma',schema]] });
  const dmmf=await m.getDMMF({ datamodel:[['schema.prisma',schema]] });
  console.log('✅ SCHEMA VALID');
  console.log('models:',dmmf.datamodel.models.length,'| enums:',dmmf.datamodel.enums.length);
}catch(e){
  let msg=e.message||String(e);
  console.log('❌\n'+msg.slice(0,5000));
  process.exit(1);
}
})();
