import {createLocalDatabase} from './fixtures/local-database.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const db=await createLocalDatabase();
try{
 const rows=(await db.query(`select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='ai_followup_sessions' order by ordinal_position`)).rows;
 const properties=kind=>rows.map(c=>`          ${c.column_name}${kind==='Update'||kind==='Insert'&&(c.is_nullable==='YES'||c.column_default!==null)?'?':''}: ${c.data_type==='jsonb'?'Json':c.data_type==='integer'?'number':'string'}${c.is_nullable==='YES'?' | null':''}`).join('\n');
 const fragment=`      // BEGIN followup generated types\n      ai_followup_sessions: {\n        Row: {\n${properties('Row')}\n        }\n        Insert: {\n${properties('Insert')}\n        }\n        Update: {\n${properties('Update')}\n        }\n        Relationships: []\n      }\n      // END followup generated types\n`;
 const file=new URL('../src/lib/supabase/database.types.ts',import.meta.url);
 let text=await readFile(file,'utf8');
 text=text.replace(/      \/\/ BEGIN followup generated types[\s\S]*?      \/\/ END followup generated types\r?\n/,'').replace('    Tables: {','    Tables: {\n'+fragment);
 if(!text.includes('      claim_followup_attempt:'))text=text.replace('    Functions: {','    Functions: {\n      claim_followup_attempt: { Args: Record<PropertyKey, never>; Returns: boolean }');
 await writeFile(file,text);console.log('Generated followup types from local migrated PostgreSQL.');
}finally{await db.close();}
