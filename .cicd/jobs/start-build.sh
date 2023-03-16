#!/bin/bash

set -e
. .cicd/helpers/bash_tools.sh
header "Start-Build.sh"


# Init Vars
JIRA_CARD="$(git ls-remote --heads origin | grep $(git rev-parse HEAD) |cut -d / -f 4|cut -d- -f1-2| tr -d "-")"
	if [ -z "${JIRA_CARD}" ] && [ "${STAGE}" == "feature" ]; then
		JIRA_CARD=$(echo "${GIT_BRANCH}" | cut -d/ -f1| tr -d "-")
		if [ -z "${JIRA_CARD}" ] && [ "${STAGE}" == "feature" ]; then
			echo "ERROR FINDING JIRA CARD!!!!"
			echo "Please check that your branch name matches the pattern:"
			echo "(feature|main|release|hotfix)/(JIRA CARD NUMBER)-(any name that helps idenitify work in this branch.)"
			echo "e.x. feature/xbs-533-remove-rsubs-dependancies"
			echo "e.x. release/xbs-533-rsubs-dep-delete-release"
			exit 1
		fi
	fi
GIT_TAG=$(python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_TAG: ' | cut -d ':' -f2)
GIT_BRANCH=$(python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_BRANCH: ' | cut -d ':' -f2)
GIT_TAG_OR_BRANCH=$(python3 .cicd/helpers/get_tag_or_branch.py | grep -E '^GIT_TAG_OR_BRANCH:' | cut -d ':' -f2)


#Validate STAGE
if [[ ${GIT_TAG} =~ "^feature" || ${GIT_TAG} =~ "^main" || ${GIT_TAG} =~ "^release" || ${GIT_TAG} =~ "^hotfix" ]]; then
	echo "Please check that your branch name matches the pattern:"
	echo "(feature|main|release|hotfix)/(JIRA CARD NUMBER)-(any name that helps idenitify work in this branch.)"
	echo "e.x. feature/xbs-533-remove-rsubs-dependancies"
	echo "e.x. release/xbs-533-rsubs-dep-delete-release"
	exit 1
fi
COMPONENTS=$(echo -n "${GIT_TAG}"| cut -d / -f 2)
STAGE=$(echo -n "${GIT_TAG}"| cut -d / -f 3)
#Validate COMPONETS
ALL_COMPONENTS=$(yq e '.[] | select(has("type")) | path | .[]' ./components.yaml)
# Extract the component name from GIT_TAG
IFS='/' read -ra git_tag_parts <<< "$GIT_TAG"
component_name=${git_tag_parts[1]}

# Iterate through the ALL_COMPONENTS array and check if it matches the extracted component name
valid_component=false
for component in $ALL_COMPONENTS; do
    if [ "$component" == "$component_name" ]; then
        valid_component=true
        break
    fi
done

if [ "$valid_component" = true ]; then
    echo "The component in GIT_TAG matches a component '${COMPONENTS}' in the components.yaml file."
else
    echo "The component in GIT_TAG does not match any component in the components.yaml file."
fi


# Output to user
echo "|> COMPONENTS		: $(echo -n ${COMPONENTS[*]})"
echo "|> STAGE		: ${STAGE}"
echo "|> GIT_TAG     		: ${GIT_TAG}"
echo "|> GIT_BRANCH     	: ${GIT_BRANCH}"
echo "|> GIT_TAG_OR_BRANCH	: ${GIT_TAG_OR_BRANCH}"
echo "|> GITHUB_SHA		: ${GITHUB_SHA}"

# Tag format
# Start-build/(component_name)/(Build_Type)/(Timestamp)-(Username)

i=0
for COMPONENT in $COMPONENTS
do
	((i=i+1))
	header "#${i} Component '${COMPONENT}'"

	# Envs.
	MAJOR_VERSION=$(yq e ".${COMPONENT}.major_version" ./components.yaml )
	MINOR_VERSION=$(yq e ".${COMPONENT}.minor_version" ./components.yaml )
	PATCH_VERSION=$(yq e ".${COMPONENT}.patch_version" ./components.yaml ) # Optional. Will try to calculate.
	ENABLE_SIMPLE_VERSION=$(yq e ".${COMPONENT}.enable_simple_version" ./components.yaml )

	if [[ "${MAJOR_VERSION}" == 0 ]] && [[ "${MINOR_VERSION}" == "0" ]]; then
		# https://stackoverflow.com/questions/38252708/is-0-0-1-valid-semver
		header "0.0.* is invalid SemVer. Please start with 0.1.0"
		exit 1
	fi
	if [[ -z "${PATCH_VERSION}" ]] || [[ -n "${PATCH_VERSION}" ]]; then
		PATCH_VERSION="0"
	fi
	echo "|>  STAGE: 					${STAGE}"
	echo "|>  MAJOR_VERSION: 			${MAJOR_VERSION}"
	echo "|>  MINOR_VERSION: 			${MINOR_VERSION}"
	echo "|>  PATCH_VERSION: 			${PATCH_VERSION}"
	echo "|>  JIRA_CARD: 				${JIRA_CARD}"
	echo "|>  ENABLE_SIMPLE_VERSION:	${ENABLE_SIMPLE_VERSION}"

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
	GIT_BRANCH=${GIT_BRANCH} \
	VERSION_BASE=$(echo "${VERSION_BASE}" |tr '[:upper:]' '[:lower:]') \
	/bin/bash .cicd/helpers/tag_latest_component_semver.sh
done