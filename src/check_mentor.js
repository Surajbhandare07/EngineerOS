const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vsymqmrkkwqdcbgepnez.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeW1xbXJra3dxZGNiZ2VwbmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTY3NDksImV4cCI6MjA5MjQzMjc0OX0.YMFwA45dbSs6BJ0M34NrVwZOB-gO7mVKfWbDej_jJyI'
);

async function checkMentorPoints() {
  const { data, error } = await supabase.from('profiles').select('mentor_points').limit(1);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Success! mentor_points exists.");
  }
}

checkMentorPoints();
