locals {
  storage_buckets = {
    member_photos = {
      id                 = "member-photos"
      name               = "member-photos"
      public             = var.public_buckets
      file_size_limit    = var.bucket_file_size_limit
      allowed_mime_types = var.allowed_image_mime_types
    }
    tenant_logos = {
      id                 = "tenant-logos"
      name               = "tenant-logos"
      public             = var.public_buckets
      file_size_limit    = var.bucket_file_size_limit
      allowed_mime_types = var.allowed_image_mime_types
    }
  }
}

resource "terraform_data" "storage_bucket" {
  for_each = local.storage_buckets

  input = each.value

  triggers_replace = [
    jsonencode(each.value),
  ]

  provisioner "local-exec" {
    command     = "node scripts/apply-storage-bucket.mjs"
    working_dir = path.module

    environment = {
      SUPABASE_URL              = var.SUPABASE_URL
      SUPABASE_SERVICE_ROLE_KEY = var.SUPABASE_SERVICE_ROLE_KEY
      BUCKET_ID                 = each.value.id
      BUCKET_NAME               = each.value.name
      BUCKET_PUBLIC             = tostring(each.value.public)
      BUCKET_FILE_SIZE_LIMIT    = tostring(each.value.file_size_limit)
      BUCKET_ALLOWED_MIME_TYPES = jsonencode(each.value.allowed_mime_types)
    }
  }
}
