#!/bin/bash

set -e
. .cicd/helpers/bash_tools.sh
header "Start-Build-on-Push.sh"

# Init Vars
GIT_TAG=$(python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_TAG: ' | cut -d ':' -f2)
GIT_BRANCH=$(python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_BRANCH:' | cut -d ':' -f2)
GIT_TAG_OR_BRANCH=$(python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_TAG_OR_BRANCH:' | cut -d ':' -f2)

#Validate STAGE
if [[ ${GIT_BRANCH} =~ "^feature" || ${GIT_BRANCH} =~ "^main" || ${GIT_BRANCH} =~ "^release" || ${GIT_BRANCH} =~ "^hotfix" ]]; then
	echo "Please check that your branch name matches the pattern:"
	echo "(feature|main|release|hotfix)/(JIRA CARD NUMBER)-(any name that helps idenitify work in this branch.)"
	echo "e.x. feature/xbs-533-remove-rsubs-dependancies"
	echo "e.x. release/xbs-533-rsubs-dep-delete-release"
	exit 1
fi
ALL_COMPONENTS=$(yq e '.[] | select(has("type")) | path | .[]' ./components.yaml)
STAGE=$(echo -n "${GIT_TAG}"| cut -d / -f 3)

# Output to user
echo "|> ALL_COMPONENTS			: $(echo -n ${COMPONENTS[*]})"
echo "|> COMPONENTS				: $(echo -n ${COMPONENTS[*]})"
echo "|> STAGE					: ${STAGE}"
echo "|> GIT_TAG     			: ${GIT_TAG}"
echo "|> GIT_BRANCH     		: ${GIT_BRANCH}"
echo "|> GIT_TAG_OR_BRANCH		: ${GIT_TAG_OR_BRANCH}"
echo "|> GITHUB_SHA				: ${GITHUB_SHA}"

# Tag format
# start-build/(component_name)/(Build_Type)/(Timestamp)-(Username)
# ex. start-build/cbdc-admin-ui-dev/feature/20230113112529-slester

i=0
for COMPONENT in $COMPONENTS
do
	((i=i+1))
	header "#${i} Component '${COMPONENT}'"
	# Envs.
	MAJOR_VERSION=$(yq e ".${COMPONENT}.major_version" ./components.yaml )
	MINOR_VERSION=$(yq e ".${COMPONENT}.minor_version" ./components.yaml )
	PATCH_VERSION=$(yq e ".${COMPONENT}.patch_version" ./components.yaml )
	ENABLE_SIMPLE_VERSION=$(yq e ".${COMPONENT}.enable_simple_version" ./components.yaml )
	JIRA_CARD=$(git ls-remote --heads origin | grep $(git rev-parse HEAD) |cut -d / -f 4|cut -d- -f1-2| tr -d "-" || echo "${GITHUB_REF_NAME}" | cut -d/ -f1| tr -d "-")

	if [[ "${MAJOR_VERSION}" == 0 ]] && [[ "${MINOR_VERSION}" == "0" ]]; then
		# https://stackoverflow.com/questions/38252708/is-0-0-1-valid-semver
		header "0.0.* is invalid SemVer. Please start with 0.1.0"
		exit 1
	fi
	[ -z "${PATCH_VERSION}"{MAJOR_VERSION}

	VERSION_BASE=$( \
			STAGE=${STAGE} \
			MAJOR_VERSION=${MAJOR_VERSION} \
			MINOR_VERSION=${MINOR_VERSION} \
			PATCH_VERSION=${PATCH_VERSION} \
			JIRA_CARD=${JIRA_CARD} \
			ENABLE_SIMPLE_VERSION=${ENABLE_SIMPLE_VERSION} \
			python3 .cicd/helpers/compute_version.py)

	echo "VERSION_BASE: '${VERSION_BASE}'"
	# This tags the latest version for automated building.
	ENABLE_SIMPLE_VERSION=${ENABLE_SIMPLE_VERSION}\
	GITHUB_SHA=${GITHUB_SHA} \
	COMPONENT=${COMPONENT} \
	VERSION_BASE=$(echo "${VERSION_BASE}" |tr '[:upper:]' '[:lower:]') \
	/bin/bash .cicd/helpers/tag_latest_component_semver.sh
done