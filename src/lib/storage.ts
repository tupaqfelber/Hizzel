import { createClient } from "@/lib/supabase/client";

// Path convention (matches the storage RLS policy, which owns writes by the
// leading {user_id} folder segment): {user_id}/{kind}/{id}.{ext}
async function uploadPhoto(userId: string, kind: string, id: string, file: File) {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${kind}/${id}.${ext}`;

  const { error } = await supabase.storage
    .from("photos")
    .upload(path, file, { upsert: true });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("photos").getPublicUrl(path);
  return publicUrl;
}

export function uploadThingPhoto(userId: string, thingId: string, file: File) {
  return uploadPhoto(userId, "things", thingId, file);
}

export function uploadPropertyPhoto(userId: string, propertyId: string, file: File) {
  return uploadPhoto(userId, "properties", propertyId, file);
}
