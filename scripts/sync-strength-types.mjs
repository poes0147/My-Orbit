// Generate this feature's type fragment from all migrations in disposable PostgreSQL.
import { createLocalDatabase } from './fixtures/local-database.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const db=await createLocalDatabase();
try {
 const rows=(await db.query(`select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='strength_analyses' order by ordinal_position`)).rows;
 const properties=kind=>rows.map(c=>`          ${c.column_name}${kind==='Update'||kind==='Insert'&&(c.is_nullable==='YES'||c.column_default!==null)?'?':''}: ${c.data_type==='jsonb'?'Json':'string'}${c.is_nullable==='YES'?' | null':''}`).join('\n');
 const fragment=`      // BEGIN strength analysis generated types\n      strength_analyses: {\n        Row: {\n${properties('Row')}\n        }\n        Insert: {\n${properties('Insert')}\n        }\n        Update: {\n${properties('Update')}\n        }\n        Relationships: []\n      }\n      // END strength analysis generated types\n`;
 const file=new URL('../src/lib/supabase/database.types.ts',import.meta.url);
 let text=await readFile(file,'utf8');
 text=text.replace(/      \/\/ BEGIN strength analysis generated types[\s\S]*?      \/\/ END strength analysis generated types\r?\n/,'');
 text=text.replace('    Tables: {','    Tables: {\n'+fragment);
 if(!text.includes('      claim_strength_analysis_attempt:')) text=text.replace('    Functions: {','    Functions: {\n      claim_strength_analysis_attempt: { Args: Record<PropertyKey, never>; Returns: boolean }');
 await writeFile(file,text);
 console.log('Generated strength_analyses types from migrated local database.');
} finally {await db.close();}
