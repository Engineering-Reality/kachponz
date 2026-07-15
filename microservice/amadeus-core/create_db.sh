#!/bin/bash
sudo -u postgres psql -c "CREATE USER amadeus WITH PASSWORD 'amadeus_local_dev';"
sudo -u postgres psql -c "CREATE DATABASE amadeus OWNER amadeus;"
echo "Database created successfully!"
