import os

# Database configuration
# TODO: Move these to environment variables for security
DATABASE_URL = "mysql+pymysql://admin:password@localhost:3306/bearboard"

# JWT configuration
SECRET_KEY = "super-secret-key-change-me"  # FIXME: This needs to be a real secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
