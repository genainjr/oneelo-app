variable "SUPABASE_URL" {
  description = "Base URL of the Supabase project, for example https://project-ref.supabase.co."
  type        = string
}

variable "SUPABASE_SERVICE_ROLE_KEY" {
  description = "Supabase service role key used only by Terraform to create or update Storage buckets."
  type        = string
  sensitive   = true
}

variable "public_buckets" {
  description = "Whether media buckets should be public. Current product decision: public buckets for member photos and tenant logos."
  type        = bool
  default     = true
}

variable "bucket_file_size_limit" {
  description = "Maximum image size accepted by Supabase Storage buckets, aligned with backend validation."
  type        = number
  default     = 5242880
}

variable "allowed_image_mime_types" {
  description = "Allowed image MIME types, aligned with backend validation."
  type        = list(string)
  default = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]
}
