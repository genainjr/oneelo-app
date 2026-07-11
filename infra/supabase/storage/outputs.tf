output "storage_bucket_ids" {
  description = "Supabase Storage buckets managed for OneElo media uploads."
  value       = [for bucket in terraform_data.storage_bucket : bucket.output.id]
}
