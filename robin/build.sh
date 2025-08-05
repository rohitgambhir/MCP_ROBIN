#! /bin/bash

mkdir -p ~/.robin/logs
mkdir -p ~/.robin/data
touch ~/.robin/logs/mcp-server.log

cd mcp-server
npm run build

cd ../mcp-client
npm run build