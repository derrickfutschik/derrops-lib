# BYOK

Customers can specify their own KMS key to encrypt the logs and configuration if they wish.

## KMS Key Policy

Customers implementing BYOK must have the following in their Trust Policy to enable usage of their KMS key.

- Allow Decryption
- Allow Usage in S3
- Allow Usage in DynamoDB
- Allow Usage in Opensearch
- Allow Usage

```json
{
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::${account_id}:root"
            },
            "Action": [
                // TODO Restrict this policy further
                "kms:Encrypt",
                "kms:Decrypt",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*",
                "kms:DescribeKey",
                "kms:GetKeyPolicy",
                "kms:GetKeyRotationStatus",
                "kms:ListAliases",
            ]
            "Resource": "arn:aws:kms:${region}:${account_id}:key/${key_id}"
        }
}
```
