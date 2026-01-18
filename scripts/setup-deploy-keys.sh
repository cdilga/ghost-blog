#!/bin/bash
# Setup script for GitHub Actions deploy keys
# Run this manually: ./scripts/setup-deploy-keys.sh

set -e

REPO="cdilga/ghost-blog"
KEY_PATH="$HOME/.ssh/ghost-deploy"

echo "=== Ghost Blog Deploy Key Setup ==="
echo ""

# Check if key already exists
if [ -f "$KEY_PATH" ]; then
    echo "Deploy key already exists at $KEY_PATH"
    read -p "Use existing key? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Generating new key..."
        ssh-keygen -t ed25519 -f "$KEY_PATH" -C "github-actions-deploy" -N ""
    fi
else
    echo "Generating deploy key..."
    ssh-keygen -t ed25519 -f "$KEY_PATH" -C "github-actions-deploy" -N ""
fi

echo ""
echo "=== Adding public key to VPS ==="
cat "$KEY_PATH.pub" | ssh ghost-blog "cat >> /root/.ssh/authorized_keys"
echo "✓ Public key added to VPS"

echo ""
echo "=== Adding private key to GitHub Secrets ==="
gh secret set SSH_PRIVATE_KEY --repo "$REPO" < "$KEY_PATH"
echo "✓ SSH_PRIVATE_KEY secret set"

echo ""
echo "=== Adding VPS host to GitHub Secrets ==="
gh secret set VPS_HOST --repo "$REPO" --body "45.77.114.162"
echo "✓ VPS_HOST secret set"

echo ""
echo "=== Setup Complete ==="
echo "GitHub Actions can now deploy to your VPS."
