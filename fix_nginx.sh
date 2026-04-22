#!/bin/bash

echo "Updating Nginx configuration..."

# Backup current configuration
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# Write new configuration
sudo bash -c 'cat > /etc/nginx/sites-available/default << "EOF"
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # 前端静态文件
    location / {
        root /var/www/db-performance-insight-platform/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF'

echo "Testing Nginx configuration..."
sudo nginx -t

echo "Restarting Nginx..."
sudo systemctl restart nginx

echo "Building frontend..."
cd /var/www/db-performance-insight-platform/frontend
npm run build

echo "Operation completed!"
