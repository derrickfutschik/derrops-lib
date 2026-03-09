# TODO
# Need a more secure way at runtime of getting all the credentials rather not from environment variables, but rather from secrets, potentially using the aws secret caching mechanism if needed

# MAIN SETTINGS
export DERROPS_SERVER_IP=192.168.7.233
export NODE_OPTIONS=--experimental-vm-modules


# SUPABASE (DEPRECATED)
export VITE_SUPABASE_PROJECT_ID="omjpxenvfphdxkarmsxk"
export VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tanB4ZW52ZnBoZHhrYXJtc3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NDM4NjIsImV4cCI6MjA3ODExOTg2Mn0.VjURgLXkLmF4xQJS-v9dbqAi0eQiCyG7aV39jBlJno0"
export VITE_SUPABASE_URL="https://omjpxenvfphdxkarmsxk.supabase.co"

# POSTGRES SETTINGS
export DB_HOST=192.168.7.233
export DB_PORT=5432

export DB_USER=postgres
export DB_USERNAME=postgres

export DB_PASSWORD=postgres
export DB_NAME=slaops
export DB_SSL=false
export DB_LOGGING=false

export PORT=8083

# APP VERSION
export APP_VERSION=0.1.0

export AWS_ACCOUNT_ID=632953687273
export NODE_ENV=dev
export AWS_REGION=ap-southeast-2

export OPENSEARCH_ENDPOINT=http://192.168.7.233:9200
export DYNAMODB_ENDPOINT=http://192.168.7.233:4566