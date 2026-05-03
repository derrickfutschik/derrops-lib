# Database Migrations

This directory contains SQL migration scripts for the Derrops Cloud database.

## Migration Files

- `001_create_service_table.sql` - Initial schema creation for the service table

## Running Migrations

### Development (TypeORM Auto-Sync)

In development mode, TypeORM is configured with `synchronize: true`, which automatically creates tables based on entity definitions. You typically don't need to run migrations manually during development.

### Production

For production deployments, you should:

1. Disable TypeORM synchronization (`synchronize: false`)
2. Run migrations manually using one of these methods:

#### Option 1: Using psql

```bash
# Connect to your Aurora Serverless database
psql -h <db-host> -U <username> -d derrops

# Run the migration
\i migrations/001_create_service_table.sql
```

#### Option 2: Using AWS RDS Data API

```bash
aws rds-data execute-statement \
  --resource-arn <cluster-arn> \
  --secret-arn <secret-arn> \
  --database derrops \
  --sql "$(cat migrations/001_create_service_table.sql)"
```

#### Option 3: SSH Tunnel via Bastion Host

```bash
# Start SSH tunnel through bastion host
aws ec2-instance-connect send-ssh-public-key \
  --instance-id <bastion-instance-id> \
  --availability-zone <az> \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub

ssh -i ~/.ssh/id_rsa -L 5432:<db-endpoint>:5432 ec2-user@<bastion-public-ip>

# In another terminal, connect via tunnel
psql -h localhost -p 5432 -U derrops_admin -d derrops
\i migrations/001_create_service_table.sql
```

## Migration Naming Convention

Migrations should follow this naming pattern:

```
<number>_<description>.sql
```

Examples:

- `001_create_service_table.sql`
- `002_add_api_keys_table.sql`
- `003_add_service_metrics.sql`

## Creating New Migrations

1. Create a new file with the next sequential number
2. Add your SQL DDL statements
3. Include a rollback section (commented out) for reference
4. Test the migration on a development database first
5. Update this README with the new migration

## Rollback

To rollback a migration, you'll need to manually write and execute the reverse SQL statements. It's recommended to include commented rollback SQL in each migration file.

Example:

```sql
-- Rollback for 001_create_service_table.sql
-- DROP TRIGGER IF EXISTS update_service_updated_at ON service;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS service;
```
