#!/bin/bash
set -e

echo "🔧 Setting up API Contract Platform..."

git config core.hooksPath .githooks
echo "✅ Pre-commit hook activated"

echo "🎉 Done"
