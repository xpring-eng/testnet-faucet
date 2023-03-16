#!/bin/bash

set -e
. .cicd/helpers/bash_tools.sh
header "tag_latest_semver.sh"

: "${COMPONENT:? Need to set COMPONENT}"
: "${GITHUB_SHA:? Need to set GITHUB_SHA}"
: "${VERSION_BASE:? Need to set VERSION_BASE}"


CV_NAMESPACE="component-version"

echo "GITHUB_SHA			: $GITHUB_SHA"
echo "COMPONENT			: ${COMPONENT}"
echo "CV_NAMESPACE			: ${CV_NAMESPACE}"
echo "VERSION_BASE			: ${VERSION_BASE}"

#figure out old version and increment
git config --global user.email "actions@github.com"
git config --global user.name "Github Actions Runner"

echo "Gathering all tags for component: ${COMPONENT}"
git fetch --tags -f > /dev/null 2>&1
echo "Finding latest version tag."
echo "searching for '${CV_NAMESPACE}/${COMPONENT}/${VERSION_BASE}*'"
LATEST_TAG=$(git tag -l --sort=version:refname "${CV_NAMESPACE}/${COMPONENT}/${VERSION_BASE}*" |cut -d/ -f3)
[ $ENABLE_SIMPLE_VERSION == "true" ] && \
	LATEST_TAG=$(echo -n "${LATEST_TAG}" | sed "/\b-\b/d" -| sed "/\b+\b/d" - |tail -n 1) || \
	LATEST_TAG=$(echo -n "${LATEST_TAG}" | tail -n 1)
echo "LATEST_TAG: ${LATEST_TAG}"
echo "VERSION_BASE: ${VERSION_BASE}"

CURRENT_PATCH="${LATEST_TAG#$VERSION_BASE}"
echo "CURRENT_PATCH: ${CURRENT_PATCH}"
NEXT_PATCH=$(($CURRENT_PATCH+1))
NEXT_TAG_VERSION="${VERSION_BASE}${NEXT_PATCH}"
echo "NEXT_TAG_VERSION: ${NEXT_TAG_VERSION}"

# https://stackoverflow.com/questions/38252708/is-0-0-1-valid-semver
if [[ ${NEXT_TAG_VERSION} =~ ^[0].[0].* ]]; then
	echo "0.0.* is invalid SEMVER incrementsing MINOR version"
	echo "NEXT_TAG_VERSION: '${NEXT_TAG_VERSION}'"
	N=${NEXT_TAG_VERSION//[!0-9]/ }
    A=(${N//\./ })
    MAJOR=${A[0]}
    MINOR=1
    PATCH=${A[2]}
    if [[ "${NEXT_TAG_VERSION}" == *"-"* ]];then
    	NEXT_TAG_VERSION="${MAJOR}.${MINOR}.${PATCH}-${NEXT_TAG_VERSION#*-}"
    else
    	NEXT_TAG_VERSION="${MAJOR}.${MINOR}.${PATCH}}"
    fi
fi

if [[ -z ${NEXT_TAG_VERSION} ]]; then
	echo "NEXT_TAG_VERSION var empty exiting."
	exit 1
fi

echo "New Version to be tagged: ${NEXT_TAG_VERSION}"
NEW_TAG="component-version/${COMPONENT}/${NEXT_TAG_VERSION}"
NEW_TAG=$(echo "$NEW_TAG"|tr '[:upper:]' '[:lower:]')
echo "Taging with: $NEW_TAG"
git tag -a $NEW_TAG -m "Tagged by github tag_latest_component_semver.sh" $GITHUB_SHA
git push --tags
