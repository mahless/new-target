export async function deleteFromSupabase(table: string, id: string) {
  const { supabase } = await import('./src/lib/supabase');
  await supabase.from(table).delete().eq('id', id);
}
