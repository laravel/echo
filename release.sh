#!/bin/bash
set -euo pipefail

REPO="laravel/echo"
BRANCH="2.x"

# Ensure we are on correct branch and the working tree is clean
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "Error: must be on $BRANCH branch (current: $CURRENT_BRANCH)" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is not clean. Commit or stash changes before releasing." >&2
  git status --porcelain
  exit 1
fi

get_current_version() {
    local package_json=$1
    if [ -f "$package_json" ]; then
        grep '"version":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found at $package_json"
        exit 1
    fi
}

get_package_name() {
    local package_json=$1
    if [ -f "$package_json" ]; then
        grep '"name":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found at $package_json"
        exit 1
    fi
}

update_version() {
    local package_dir=$1
    local version_type=$2

    case $version_type in
        "patch")
            pnpm version patch --no-git-tag-version
            ;;
        "minor")
            pnpm version minor --no-git-tag-version
            ;;
        "major")
            pnpm version major --no-git-tag-version
            ;;
        *)
            echo "Invalid version type. Please choose patch/minor/major"
            exit 1
            ;;
    esac
}

if [ -n "$(git status --porcelain)" ]; then
    echo "Error: There are uncommitted changes in the working directory"
    echo "Please commit or stash these changes before proceeding"
    exit 1
fi

git pull

ROOT_PACKAGE_JSON="packages/react/package.json"
CURRENT_VERSION=$(get_current_version "$ROOT_PACKAGE_JSON")
echo ""
echo "Current version: $CURRENT_VERSION"
echo ""

echo "Select version bump type:"
echo "1) patch (bug fixes)"
echo "2) minor (new features)"
echo "3) major (breaking changes)"
echo

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        RELEASE_TYPE="patch"
        ;;
    2)
        RELEASE_TYPE="minor"
        ;;
    3)
        RELEASE_TYPE="major"
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

for package_dir in packages/*; do
    if [ -d "$package_dir" ]; then
        echo "Updating version for $package_dir"

        cd $package_dir

        update_version "$package_dir" "$RELEASE_TYPE"

        cd ../..

        echo ""
    fi
done

NEW_VERSION=$(get_current_version "$ROOT_PACKAGE_JSON")
TAG="v$NEW_VERSION"

echo "Updating lock file..."
pnpm i
echo ""

echo "Staging package.json files..."
git add "**/package.json"
echo ""

git commit -m "$TAG"
git tag -a "$TAG" -m "$TAG"
git push
git push --tags

gh release create "$TAG" --generate-notes

echo ""
echo "✅ Release $TAG completed successfully, publishing kicked off in CI."
echo "🔗 https://github.com/$REPO/releases/tag/$TAG"

# Echo joke
echo "Released! (Released!) (Released!)"
