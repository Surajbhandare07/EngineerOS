const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vsymqmrkkwqdcbgepnez.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeW1xbXJra3dxZGNiZ2VwbmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTY3NDksImV4cCI6MjA5MjQzMjc0OX0.YMFwA45dbSs6BJ0M34NrVwZOB-gO7mVKfWbDej_jJyI'
);

async function inspectProfiles() {
  console.log("Inspecting 'profiles' table...");
  
  // Try to insert a dummy record (it will fail, but might give us column info or error)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Select Error:", error.message);
  } else {
    console.log("Table exists. Current data:", data);
    if (data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    }
  }
}

inspectProfiles();
