const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
  console.log("Checking tables...");
  
  const tables = ['profiles', 'documents', 'tasks', 'study_plans', 'viva_sessions'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`Table '${table}' error:`, error.message);
    } else {
      console.log(`Table '${table}' exists. Columns:`, data.length > 0 ? Object.keys(data[0]) : "Empty table (can't see columns)");
      
      // Try to get column info from a query if table is empty
      if (data.length === 0) {
          const { data: colData, error: colError } = await supabase.rpc('get_table_columns', { table_name: table });
          if (!colError) console.log(`Columns for ${table}:`, colData);
      }
    }
  }
}

checkSchema();
