terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # State lives in S3 with locking. Pass bucket, key, region and dynamodb_table
  # with -backend-config at init; see docs/RUNBOOK.md.
  backend "s3" {}
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.name
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
