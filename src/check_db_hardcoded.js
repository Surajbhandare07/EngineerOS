const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vsymqmrkkwqdcbgepnez.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeW1xbXJra3dxZGNiZ2VwbmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTY3NDksImV4cCI6MjA5MjQzMjc0OX0.YMFwA45dbSs6BJ0M34NrVwZOB-gO7mVKfWbDej_jJyI'
);

async function checkSchema() {
  const tables = ['profiles', 'documents', 'tasks', 'study_plans', 'viva_sessions'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}' error:`, error.message);
    } else {
      console.log(`Table '${table}' exists. Rows: ${data.length}`);
      if (data.length > 0) console.log(`Columns:`, Object.keys(data[0]));
    }
  }
}
checkSchema();
