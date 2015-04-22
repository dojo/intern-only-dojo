#!/usr/bin/env bash

set -e

usage() {
	echo "Usage: $0 [branch] [version]"
	echo
	echo "Branch defaults to 'master'."
	echo "Version defaults to what is listed in package.json in the branch."
	echo "Version should only be specified for pre-releases."
	exit 1
}

ORIGINAL_REVISION=$(git rev-parse --abbrev-ref HEAD)

if [ "$1" == "--help" ]; then
	usage
	exit 0
elif [ "$1" == "" ]; then
	BRANCH=$ORIGINAL_REVISION
else
	BRANCH=$1
fi

NPM_TAG=latest

if [ "$2" != "" ]; then
	VERSION=$2
	NPM_TAG=beta
fi

ROOT_DIR=$(cd $(dirname $0) && cd .. && pwd)
BUILD_DIR="$ROOT_DIR/dist"

if [ $(git status --porcelain |grep '^.. src/' |wc -l) -gt 0 ]; then
	echo "Uncommitted changes exist in your current source directory"
	echo "Aborted."
	exit 1
fi

echo "This is an internal Dojo release script!"
echo -n "Press 'y' to create a new Dojo release from branch $BRANCH"
if [ "$VERSION" == "" ]; then
	echo "\nto npm tag $NPM_TAG."
else
	echo -e "\nwith version override $VERSION to npm tag $NPM_TAG."
fi
echo "(You can abort pushing upstream later on if something goes wrong.)"
read -s -n 1

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

cd "$ROOT_DIR"

# Store the newly created tags and all updated branches outside of the loop so we can push/publish them all at once
# at the end instead of having to guess that the second loop will run successfully after the first one
RELEASE_TAG=
PUSH_BRANCHES="$BRANCH"

echo -e "\nBuilding $BRANCH branch...\n"

if [ "$BRANCH" != "$ORIGINAL_REVISION" ]; then
	git checkout $BRANCH
fi

# Get the version number for this release from package.json
if [ "$VERSION" == "" ]; then
	VERSION=$(grep -o '"version": "[^"]*"' package.json | grep -o "[0-9][0-9.]*")

	# Convert the version number to an array that we can use to generate the next release version number
	OLDIFS=$IFS
	IFS="."
	PRE_VERSION=($VERSION)
	IFS=$OLDIFS

	# This is a new major/minor release
	if [[ $VERSION =~ \.0$ ]]; then
		# We'll be creating a new minor release branch for this version for any future patch releases
		MAKE_BRANCH="${PRE_VERSION[0]}.${PRE_VERSION[1]}"
		BRANCH_VERSION="${PRE_VERSION[0]}.${PRE_VERSION[1]}.$((PRE_VERSION[2] + 1))-pre"

		# The next release is usually going to be a minor release; if the next version is to be a major release,
		# the package version will need to be manually updated in Git before release
		PRE_VERSION="${PRE_VERSION[0]}.$((PRE_VERSION[1] + 1)).0-pre"

	# This is a new patch release
	else
		# Patch releases do not get a branch
		MAKE_BRANCH=
		BRANCH_VERSION=

		# The next release version will always be another patch version
		PRE_VERSION="${PRE_VERSION[0]}.${PRE_VERSION[1]}.$((PRE_VERSION[2] + 1))-pre"
	fi
else
	MAKE_BRANCH=
	BRANCH_VERSION=
	PRE_VERSION=$(grep -o '"version": "[^"]*"' package.json | grep -o "[0-9][0-9.]*")
	PRE_VERSION="$PRE_VERSION-pre"
fi

TAG_VERSION=$VERSION
RELEASE_TAG="$TAG_VERSION"

# At this point:
# $VERSION is the version of Mayhem that is being released;
# $TAG_VERSION is the name that will be used for the Git tag for the release
# $PRE_VERSION is the next pre-release version of Mayhem that will be set on the original branch after tagging
# $MAKE_BRANCH is the name of the new minor release branch that should be created (if this is not a patch release)
# $BRANCH_VERSION is the pre-release version of Mayhem that will be set on the minor release branch

# Something is messed up and this release has already happened
if [ $(git tag |grep -c "^$TAG_VERSION$") -gt 0 ]; then
	echo -e "\nTag $TAG_VERSION already exists! Please check the branch.\n"
	exit 1
fi

# Set the package version to release version
sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json bower.json

# Commit the new release to Git
git commit -m "Updating metadata for $VERSION" package.json bower.json
git tag -a -m "Release $VERSION" $TAG_VERSION

# Set the package version to next pre-release version
sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$PRE_VERSION\"/" package.json bower.json

# Commit the pre-release to Git
git commit -m "Updating source version to $PRE_VERSION" package.json bower.json

# If this is a major/minor release, we also create a new branch for it
if [ "$MAKE_BRANCH" != "" ]; then
	# Create the new branch starting at the tagged release version
	git checkout -b $MAKE_BRANCH $TAG_VERSION

	# Set the package version to the next patch pre-release version
	sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$BRANCH_VERSION\"/" package.json bower.json

	# Commit the pre-release to Git
	git commit -m "Updating source version to $BRANCH_VERSION" package.json bower.json

	# Store the branch as one that needs to be pushed when we are ready to deploy the release
	PUSH_BRANCHES="$PUSH_BRANCHES $MAKE_BRANCH"
fi

# Create pre-built release for bower & npm
git checkout $TAG_VERSION
grunt clean
#TODO: Re-enable bower
# git clone -n git@github.com:SitePen/mayhem-bower.git "$BUILD_DIR"
grunt build
cd "$BUILD_DIR"
#TODO: Re-enable bower
# git add -A
# git commit -m "Update pre-built release version $VERSION"
# git tag -a -m "Release $VERSION" $TAG_VERSION

cd "$ROOT_DIR"
echo -e "\nDone!\n"

echo "Please confirm packaging success, then press 'y', ENTER to publish to npm, push"
echo "tags, and upload, or any other key to bail."
read -p "> "

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

#TODO: Re-enable bower
#for BRANCH in $PUSH_BRANCHES; do
#	git push origin $BRANCH
#done
#
#git push origin --tags

cd "$BUILD_DIR"
npm publish --tag $NPM_TAG
for BRANCH in $PUSH_BRANCHES; do
	git push origin $BRANCH
done
git push origin --tags

cd "$ROOT_DIR"
git checkout "$ORIGINAL_REVISION"

echo -e "\nAll done! Yay!"
