#!/bin/bash
set -e

echo "🧹 Cleaning build artifacts..."

# Clean root node_modules
if [ -d "node_modules" ]; then
    echo "Removing root node_modules..."
    rm -rf node_modules
fi

# Clean package node_modules and build outputs
for package in shared api frontend worker; do
    package_dir="packages/$package"
    if [ -d "$package_dir" ]; then
        echo "Cleaning $package..."
        if [ -d "$package_dir/node_modules" ]; then
            rm -rf "$package_dir/node_modules"
        fi
        if [ -d "$package_dir/dist" ]; then
            rm -rf "$package_dir/dist"
        fi
    fi
done

# Clean TypeScript build info
find . -name "*.tsbuildinfo" -type f -delete

echo "✅ Clean complete!"
echo "Run 'npm run bootstrap' to reinstall and set up again."